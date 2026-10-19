"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/business";
import { normalizePhone } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/server";
import { billingConfigured, getStripe } from "@/lib/billing/stripe";
import { syncStripeSubscription } from "@/lib/billing/sync";

export type R = { ok?: boolean; error?: string };

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().refine((v) => !v || /^\d{12,13}$/.test(normalizePhone(v)), "WhatsApp inválido"),
  address: z.string().trim().max(300).optional(),
  min_notice_minutes: z.coerce.number({ message: "Antecedência mínima inválida" }).int().min(0).max(10080, "Antecedência mínima: até 7 dias"),
  max_days_ahead: z.coerce.number({ message: "Agenda aberta inválida" }).int().min(1, "Agenda aberta: mínimo 1 dia").max(365, "Agenda aberta: até 365 dias"),
  slot_step_minutes: z.coerce.number({ message: "Intervalo dos horários inválido" }).int().min(5, "Intervalo dos horários: mínimo 5 minutos").max(240, "Intervalo dos horários: máximo 4 horas").refine((n) => n % 5 === 0, "Intervalo dos horários: use múltiplos de 5 minutos"),
  cancel_notice_minutes: z.coerce.number({ message: "Prazo de cancelamento inválido" }).int().min(0).max(10080, "Prazo de cancelamento: até 7 dias"),
  cancellation_policy: z.string().trim().max(1000).optional(),
});

export async function saveSettings(_: R, form: FormData): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (role !== "owner" && role !== "admin") return { error: "Sem permissão" };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { whatsapp, address, cancellation_policy, ...rest } = parsed.data;
  const { error } = await supabase.from("businesses").update({
    ...rest,
    whatsapp: whatsapp ? normalizePhone(whatsapp) : null,
    address: address ? { text: address } : null,
    cancellation_policy: cancellation_policy || null,
  }).eq("id", business.id);
  // Banco ainda com a regra antiga do intervalo (só 5, 10, 15, 20, 30 ou 60): falta rodar supabase-intervalo.sql
  if (error?.code === "23514" && /slot_step/.test(error.message)) return { error: "Esse intervalo de horários ainda não está liberado. Por enquanto use 5, 10, 15, 20, 30 ou 60 minutos." };
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/painel", "layout");
  return { ok: true };
}

/** Cancelamento simples: só o dono, sem retenção forçada. Agenda segue até o fim do período pago/teste. */
export async function cancelSubscription(): Promise<R> {
  const { business, role, userId } = await getContext();
  if (role !== "owner") return { error: "Só o dono pode cancelar a assinatura." };
  const admin = createServiceClient();
  const { data: sub } = await admin.from("subscriptions").select("id, status, trial_ends_at, current_period_end, provider, provider_subscription_id, provider_status").eq("business_id", business.id).single();
  if (!sub) return { error: "Assinatura não encontrada" };

  // Assinatura paga: cancela na Stripe e só então atualiza o acesso, com o estado que a Stripe devolver
  if (sub.provider === "stripe" && sub.provider_subscription_id && sub.provider_status !== "canceled") {
    if (!billingConfigured()) return { error: "Não foi possível cancelar agora. Tente de novo mais tarde." };
    try {
      await getStripe().subscriptions.update(sub.provider_subscription_id, { cancel_at_period_end: true });
      await syncStripeSubscription(admin, sub.provider_subscription_id, { event: "canceled_by_owner" });
    } catch (e) {
      console.error("cancel stripe", String(e));
      return { error: "Não foi possível cancelar agora. Tente de novo mais tarde." };
    }
  } else {
    const until = sub.status === "trialing" ? sub.trial_ends_at : sub.current_period_end;
    await admin.from("subscriptions").update({ status: "canceled", cancel_at_period_end: true, current_period_end: until }).eq("id", sub.id);
    await admin.from("subscription_events").insert({ subscription_id: sub.id, kind: "canceled_by_owner", data: { user: userId } });
  }
  revalidatePath("/painel/ajustes");
  return { ok: true };
}
