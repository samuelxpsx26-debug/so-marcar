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
