"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/business";
import { normalizePhone } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/server";

export type R = { ok?: boolean; error?: string };

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().refine((v) => !v || /^\d{12,13}$/.test(normalizePhone(v)), "WhatsApp inválido"),
  address: z.string().trim().max(300).optional(),
  min_notice_minutes: z.coerce.number().int().min(0).max(10080),
  max_days_ahead: z.coerce.number().int().min(1).max(365),
  slot_step_minutes: z.coerce.number().refine((n) => [5, 10, 15, 20, 30, 60].includes(n)),
  cancel_notice_minutes: z.coerce.number().int().min(0).max(10080),
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
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/painel", "layout");
  return { ok: true };
}

/** Cancelamento simples: só o dono, sem retenção forçada. Agenda segue até o fim do período pago/teste. */
export async function cancelSubscription(): Promise<R> {
  const { business, role, userId } = await getContext();
  if (role !== "owner") return { error: "Só o dono pode cancelar a assinatura." };
  const admin = createServiceClient();
  const { data: sub } = await admin.from("subscriptions").select("id, status, trial_ends_at, current_period_end").eq("business_id", business.id).single();
  if (!sub) return { error: "Assinatura não encontrada" };
  const until = sub.status === "trialing" ? sub.trial_ends_at : sub.current_period_end;
  await admin.from("subscriptions").update({ status: "canceled", cancel_at_period_end: true, current_period_end: until }).eq("id", sub.id);
  await admin.from("subscription_events").insert({ subscription_id: sub.id, kind: "canceled_by_owner", data: { user: userId } });
  // TODO(cobrança): cancelar também no provedor de pagamento quando a integração entrar
  revalidatePath("/painel/ajustes");
  return { ok: true };
}
