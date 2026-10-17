"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/business";
import { normalizePhone, zonedToUtc } from "@/lib/format";

export type ActionResult = { ok?: boolean; error?: string };

const friendly = (msg?: string) =>
  msg?.includes("appointments_no_overlap") || msg?.includes("exclusion") ? "Já existe um atendimento nesse horário para esse profissional." : "Não foi possível salvar. Tente de novo.";

export async function setStatus(id: string, status: "completed" | "no_show" | "cancelled" | "confirmed"): Promise<ActionResult> {
  const { supabase, business } = await getContext();
  const patch: Record<string, unknown> = { status };
  if (status === "cancelled") Object.assign(patch, { cancelled_at: new Date().toISOString(), cancel_reason: "cancelado pelo estabelecimento" });
  const { error } = await supabase.from("appointments").update(patch).eq("id", id).eq("business_id", business.id);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/painel", "layout");
  return { ok: true };
}

/** Remarcar ou adiantar: o banco recalcula o fim e impede sobreposição */
export async function moveAppointment(id: string, startsAtIso: string, professionalId?: string): Promise<ActionResult> {
  const { supabase, business } = await getContext();
  const when = new Date(startsAtIso);
  if (Number.isNaN(when.getTime())) return { error: "Horário inválido" };
  const patch: Record<string, unknown> = { starts_at: when.toISOString() };
  if (professionalId) patch.professional_id = professionalId;
  const { error } = await supabase.from("appointments").update(patch).eq("id", id).eq("business_id", business.id);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/painel", "layout");
  return { ok: true };
}

export async function freeSlots(serviceId: string, date: string, professionalId?: string) {
  const { supabase, business } = await getContext();
  const { data } = await supabase.rpc("get_available_slots", { p_slug: business.slug, p_service: serviceId, p_date: date, p_professional: professionalId ?? null });
  return (data ?? []) as { professional_id: string; professional_name: string; starts_at: string }[];
}

const newSchema = z.object({
  customerName: z.string().trim().min(2, "Nome do cliente"),
  customerPhone: z.string().trim().refine((v) => /^\d{12,13}$/.test(normalizePhone(v)), "WhatsApp inválido"),
  serviceId: z.string().uuid("Escolha o serviço"),
  professionalId: z.string().uuid("Escolha o profissional"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário"),
  notes: z.string().max(1000).optional(),
});

export async function createAppointment(_: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = newSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const { supabase, business } = await getContext();
  const phone = normalizePhone(d.customerPhone);

  const { data: customer, error: cErr } = await supabase.from("customers")
    .upsert({ business_id: business.id, name: d.customerName, phone }, { onConflict: "business_id,phone", ignoreDuplicates: false })
    .select("id").single();
  if (cErr || !customer) return { error: "Não foi possível salvar o cliente." };

  const { data: service } = await supabase.from("services").select("price_cents").eq("id", d.serviceId).single();
  const { error } = await supabase.from("appointments").insert({
    business_id: business.id, professional_id: d.professionalId, service_id: d.serviceId, customer_id: customer.id,
    starts_at: zonedToUtc(d.date, d.time, business.timezone).toISOString(), status: "confirmed", source: "admin",
    price_cents: service?.price_cents ?? 0, notes: d.notes || null,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/painel", "layout");
  return { ok: true };
}
