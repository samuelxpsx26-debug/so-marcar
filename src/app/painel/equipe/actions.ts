"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManage, getContext } from "@/lib/business";
import { zonedToUtc } from "@/lib/format";

export type R = { ok?: boolean; error?: string };
const done = (): R => { revalidatePath("/painel/equipe"); return { ok: true }; };

export async function saveProfessional(_: R, form: FormData): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  const parsed = z.object({ id: z.string().optional(), name: z.string().trim().min(2, "Nome").max(120), bio: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, name, bio } = parsed.data;
  if (id) {
    const { error } = await supabase.from("professionals").update({ name, bio: bio || null }).eq("id", id).eq("business_id", business.id);
    if (error) return { error: "Não foi possível salvar." };
  } else {
    const { data, error } = await supabase.from("professionals").insert({ business_id: business.id, name, bio: bio || null }).select("id").single();
    if (error || !data) return { error: "Não foi possível salvar." };
    // Novo profissional começa com o horário padrão
    const rows = [1, 2, 3, 4, 5].flatMap((d) => [
      { weekday: d, start_time: "09:00", end_time: "12:00" },
      { weekday: d, start_time: "13:00", end_time: "18:00" },
    ]).map((r) => ({ ...r, business_id: business.id, professional_id: data.id }));
    await supabase.from("working_hours").insert(rows);
  }
  return done();
}

export async function setProfessionalActive(id: string, active: boolean): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  await supabase.from("professionals").update({ active }).eq("id", id).eq("business_id", business.id);
  return done();
}

const range = z.object({ weekday: z.number().int().min(0).max(6), start_time: z.string().regex(/^\d{2}:\d{2}$/), end_time: z.string().regex(/^\d{2}:\d{2}$/) })
  .refine((r) => r.end_time > r.start_time, "O fim precisa ser depois do início");

export async function saveHours(professionalId: string, ranges: { weekday: number; start_time: string; end_time: string }[]): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  const parsed = z.array(range).max(50).safeParse(ranges);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error: delErr } = await supabase.from("working_hours").delete().eq("professional_id", professionalId).eq("business_id", business.id);
  if (delErr) return { error: "Não foi possível salvar." };
  if (parsed.data.length) {
    const { error } = await supabase.from("working_hours").insert(parsed.data.map((r) => ({ ...r, business_id: business.id, professional_id: professionalId })));
    if (error) return { error: "Não foi possível salvar." };
  }
  return done();
}

export async function saveProServices(professionalId: string, serviceIds: string[]): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  await supabase.from("professional_services").delete().eq("professional_id", professionalId).eq("business_id", business.id);
  if (serviceIds.length) {
    const { error } = await supabase.from("professional_services").insert(serviceIds.map((service_id) => ({ business_id: business.id, professional_id: professionalId, service_id })));
    if (error) return { error: "Não foi possível salvar." };
  }
  return done();
}

export async function addTimeOff(_: R, form: FormData): Promise<R> {
  const { supabase, business } = await getContext();
  const parsed = z.object({
    professionalId: z.string().uuid(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), reason: z.string().max(200).optional(),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Preencha início e fim" };
  const d = parsed.data;
  const starts = zonedToUtc(d.startDate, d.startTime, business.timezone);
  const ends = zonedToUtc(d.endDate, d.endTime, business.timezone);
  if (ends <= starts) return { error: "O fim precisa ser depois do início" };
  const { error } = await supabase.from("time_off").insert({ business_id: business.id, professional_id: d.professionalId, starts_at: starts.toISOString(), ends_at: ends.toISOString(), reason: d.reason || null });
  return error ? { error: "Não foi possível salvar." } : done();
}

export async function removeTimeOff(id: string): Promise<R> {
  const { supabase, business } = await getContext();
  await supabase.from("time_off").delete().eq("id", id).eq("business_id", business.id);
  return done();
}
