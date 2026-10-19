"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManage, getContext } from "@/lib/business";

export type R = { ok?: boolean; error?: string };

const parseMoney = (v: string) => Math.round(Number((v || "0").replace(/\./g, "").replace(",", ".")) * 100);
const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Nome do serviço").max(120),
  description: z.string().trim().max(500).optional(),
  duration: z.coerce.number().int().min(5, "Duração mínima de 5 min").max(720),
  buffer: z.coerce.number().int().min(0).max(240).default(0),
  price: z.string(),
});

export async function saveService(_: R, form: FormData): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Só o dono ou administrador altera serviços." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const price = parseMoney(d.price);
  if (!Number.isFinite(price) || price < 0) return { error: "Preço inválido" };
  const row = { business_id: business.id, name: d.name, description: d.description || null, duration_minutes: d.duration, buffer_minutes: d.buffer, price_cents: price };
  const { error } = d.id
    ? await supabase.from("services").update(row).eq("id", d.id).eq("business_id", business.id)
    : await supabase.from("services").insert(row);
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/painel/servicos");
  return { ok: true };
}

export async function toggleService(id: string, active: boolean): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  const { error } = await supabase.from("services").update({ active }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/painel/servicos");
  return error ? { error: "Não foi possível alterar." } : { ok: true };
}

const packageSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Nome do pacote").max(80),
  service_id: z.string().uuid("Escolha o serviço"),
  sessions: z.coerce.number().int().min(2, "O pacote precisa ter pelo menos 2 sessões").max(100),
  price: z.string(),
  valid_days: z.coerce.number().int().min(0).max(730).default(0),
});

const missingTable = (code?: string) => code === "42P01" || code === "PGRST205" || code === "42703" || code === "PGRST204";
const NOT_READY = "Os pacotes ainda não estão liberados no seu banco. Rode o arquivo supabase-fidelidade-pacotes.sql no Supabase.";

export async function savePackage(_: R, form: FormData): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Só o dono ou administrador altera pacotes." };
  const parsed = packageSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const price = parseMoney(d.price);
  if (!Number.isFinite(price) || price <= 0) return { error: "Informe o preço do pacote" };
  const row = { business_id: business.id, name: d.name, service_id: d.service_id, sessions: d.sessions, price_cents: price, valid_days: d.valid_days || null };
  const { error } = d.id
    ? await supabase.from("packages").update(row).eq("id", d.id).eq("business_id", business.id)
    : await supabase.from("packages").insert(row);
  if (missingTable(error?.code)) return { error: NOT_READY };
  if (error) return { error: "Não foi possível salvar o pacote." };
  revalidatePath("/painel", "layout");
  return { ok: true };
}

export async function togglePackage(id: string, active: boolean): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  const { error } = await supabase.from("packages").update({ active }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/painel", "layout");
  return error ? { error: "Não foi possível alterar." } : { ok: true };
}
