"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManage, getContext } from "@/lib/business";
import { normalizePixKey, type PixKeyType } from "@/lib/pix";

export type R = { ok?: boolean; error?: string };

const parseMoney = (v: string) => Math.round(Number((v || "0").replace(/\./g, "").replace(",", ".")) * 100);
const schema = z.object({
  enabled: z.literal("on").optional(),
  mode: z.enum(["percent", "fixed"]).default("percent"),
  percent: z.string().optional(),
  fixed: z.string().optional(),
  hold: z.coerce.number().int().min(10).max(1440).default(60),
  key_type: z.enum(["cpf", "cnpj", "telefone", "email", "aleatoria"]).default("telefone"),
  key: z.string().trim().max(120).default(""),
  holder: z.string().trim().max(60).default(""),
  city: z.string().trim().max(40).default(""),
});

export async function saveDeposit(_: R, form: FormData): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Só o dono ou administrador altera o sinal." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Confira os campos do sinal." };
  const d = parsed.data;

  let row: Record<string, unknown> = { deposit_mode: "off" };
  if (d.enabled) {
    const value = d.mode === "percent" ? Math.round(Number((d.percent ?? "").replace(",", "."))) : parseMoney(d.fixed ?? "");
    if (d.mode === "percent" && !(value >= 1 && value <= 100)) return { error: "Use uma porcentagem de 1 a 100." };
    if (d.mode === "fixed" && !(value >= 100 && value <= 10_000_000)) return { error: "O sinal fixo precisa ser de pelo menos R$ 1,00." };
    const key = normalizePixKey(d.key_type as PixKeyType, d.key);
    if (!key) return { error: "Chave Pix inválida. Confira o tipo e a chave." };
    if (d.holder.length < 2) return { error: "Informe o nome de quem recebe o Pix." };
    if (d.city.length < 2) return { error: "Informe a cidade." };
    row = { deposit_mode: d.mode, deposit_value: value, deposit_hold_minutes: d.hold, pix_key_type: d.key_type, pix_key: key, pix_holder: d.holder, pix_city: d.city };
  }
  const { error } = await supabase.from("businesses").update(row).eq("id", business.id);
  // Coluna inexistente: o SQL do sinal ainda não foi rodado no banco
  if (error?.code === "42703" || error?.code === "PGRST204") return { error: "O sinal por Pix ainda não está liberado no seu banco. Rode o arquivo supabase-sinal-pix.sql no Supabase." };
  if (error) return { error: "Não foi possível salvar o sinal." };
  revalidatePath("/painel", "layout");
  return { ok: true };
}
