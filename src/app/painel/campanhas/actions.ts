"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManage, getContext } from "@/lib/business";

export type R = { ok?: boolean; error?: string };

const schema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, "Use de 3 a 20 letras ou números, sem espaço (ex.: VOLTA10)"),
  kind: z.enum(["percent", "fixed"]),
  value: z.string(),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  max_uses: z.coerce.number().int().min(0).max(100000).optional(),
  once: z.string().optional(),
});

export async function saveCoupon(_: R, form: FormData): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Só o dono ou administrador cria cupons." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const value = d.kind === "percent" ? Math.round(Number(d.value)) : Math.round(Number((d.value || "0").replace(/\./g, "").replace(",", ".")) * 100);
  if (!Number.isFinite(value) || value <= 0) return { error: "Informe o valor do desconto" };
  if (d.kind === "percent" && value > 100) return { error: "O desconto em % vai até 100" };
  const { error } = await supabase.from("coupons").insert({
    business_id: business.id, code: d.code, kind: d.kind, value,
    expires_on: d.expires_on || null, max_uses: d.max_uses || null, once_per_customer: d.once === "on",
  });
  if (error) return { error: error.code === "23505" ? "Já existe um cupom com esse código." : ["42P01", "PGRST205"].includes(error.code) ? "Rode o arquivo supabase-cupons.sql no Supabase para ativar os cupons." : "Não foi possível salvar." };
  revalidatePath("/painel/campanhas");
  return { ok: true };
}

export async function toggleCoupon(id: string, active: boolean): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  const { error } = await supabase.from("coupons").update({ active }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/painel/campanhas");
  return error ? { error: "Não foi possível alterar." } : { ok: true };
}
