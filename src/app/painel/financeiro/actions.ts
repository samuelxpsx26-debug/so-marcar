"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/business";
import { parseMoney } from "@/lib/finance";

export type R = { ok?: boolean; error?: string };

const NOT_READY = ["42P01", "PGRST205"];
const fail = (code?: string) => ({ error: code && NOT_READY.includes(code) ? "Rode o arquivo supabase-financeiro.sql no Supabase para ativar o financeiro." : "Não foi possível salvar." });

async function owner() {
  const ctx = await getContext();
  return ctx.role === "owner" ? ctx : null;
}
const done = () => { revalidatePath("/painel/financeiro"); return { ok: true }; };

const expenseSchema = z.object({
  category: z.string().trim().min(2, "Escolha a categoria").max(40),
  description: z.string().trim().max(120).optional(),
  amount: z.string(),
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});

export async function addExpense(_: R, form: FormData): Promise<R> {
  const ctx = await owner();
  if (!ctx) return { error: "Só o dono lança gastos." };
  const parsed = expenseSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const cents = parseMoney(parsed.data.amount);
  if (!Number.isFinite(cents) || cents <= 0) return { error: "Informe o valor do gasto" };
  const { error } = await ctx.supabase.from("expenses").insert({
    business_id: ctx.business.id, category: parsed.data.category, description: parsed.data.description || null, amount_cents: cents, spent_on: parsed.data.spent_on,
  });
  return error ? fail(error.code) : done();
}

export async function deleteExpense(id: string): Promise<R> {
  const ctx = await owner();
  if (!ctx) return { error: "Sem permissão" };
  const { error } = await ctx.supabase.from("expenses").delete().eq("id", id).eq("business_id", ctx.business.id);
  return error ? fail(error.code) : done();
}

const fixedSchema = z.object({
  category: z.string().trim().min(2, "Escolha a categoria").max(40),
  description: z.string().trim().max(120).optional(),
  amount: z.string(),
  starts: z.string().regex(/^\d{4}-\d{2}$/, "Escolha o mês de início"),
});

export async function addFixed(_: R, form: FormData): Promise<R> {
  const ctx = await owner();
  if (!ctx) return { error: "Só o dono lança gastos." };
  const parsed = fixedSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const cents = parseMoney(parsed.data.amount);
  if (!Number.isFinite(cents) || cents <= 0) return { error: "Informe o valor do gasto" };
  const { error } = await ctx.supabase.from("fixed_expenses").insert({
    business_id: ctx.business.id, category: parsed.data.category, description: parsed.data.description || null, amount_cents: cents, starts_on: `${parsed.data.starts}-01`,
  });
  return error ? fail(error.code) : done();
}

/** Para de contar o gasto fixo depois do mês informado (se nunca chegou a valer, apaga) */
export async function endFixed(id: string, lastMonth: string): Promise<R> {
  const ctx = await owner();
  if (!ctx || !/^\d{4}-\d{2}$/.test(lastMonth)) return { error: "Sem permissão" };
  const { data } = await ctx.supabase.from("fixed_expenses").select("starts_on").eq("id", id).eq("business_id", ctx.business.id).maybeSingle();
  if (!data) return { error: "Gasto não encontrado" };
  const q = data.starts_on > `${lastMonth}-01`
    ? ctx.supabase.from("fixed_expenses").delete().eq("id", id).eq("business_id", ctx.business.id)
    : ctx.supabase.from("fixed_expenses").update({ ends_on: `${lastMonth}-01` }).eq("id", id).eq("business_id", ctx.business.id);
  const { error } = await q;
  return error ? fail(error.code) : done();
}

export async function deleteFixed(id: string): Promise<R> {
  const ctx = await owner();
  if (!ctx) return { error: "Sem permissão" };
  const { error } = await ctx.supabase.from("fixed_expenses").delete().eq("id", id).eq("business_id", ctx.business.id);
  return error ? fail(error.code) : done();
}

/** Salva (ou apaga, se o valor vier vazio) a regra de comissão do profissional, geral ou de um serviço */
export async function saveRule(professionalId: string, serviceId: string | null, mode: "percent" | "fixed", value: string): Promise<R> {
  const ctx = await owner();
  if (!ctx) return { error: "Só o dono define comissões." };
  const db = ctx.supabase;
  const scope = () => {
    const q = db.from("commission_rules").delete().eq("business_id", ctx.business.id).eq("professional_id", professionalId);
    return serviceId ? q.eq("service_id", serviceId) : q.is("service_id", null);
  };
  if (!value.trim()) {
    const { error } = await scope();
    return error ? fail(error.code) : done();
  }
  const n = mode === "percent" ? Math.round(Number(value.replace(",", ".")) * 100) : parseMoney(value);
  if (!Number.isFinite(n) || n < 0) return { error: "Valor inválido" };
  if (mode === "percent" && n > 10000) return { error: "A comissão em % vai até 100" };
  const del = await scope();
  if (del.error) return fail(del.error.code);
  const { error } = await db.from("commission_rules").insert({ business_id: ctx.business.id, professional_id: professionalId, service_id: serviceId, mode, value: n });
  return error ? fail(error.code) : done();
}

export async function setPaid(professionalId: string, month: string, amountCents: number | null): Promise<R> {
  const ctx = await owner();
  if (!ctx || !/^\d{4}-\d{2}$/.test(month)) return { error: "Sem permissão" };
  const db = ctx.supabase.from("commission_payouts");
  const { error } = amountCents === null
    ? await db.delete().eq("business_id", ctx.business.id).eq("professional_id", professionalId).eq("month", `${month}-01`)
    : await db.upsert({ business_id: ctx.business.id, professional_id: professionalId, month: `${month}-01`, amount_cents: Math.max(0, Math.round(amountCents)), paid_at: new Date().toISOString() }, { onConflict: "professional_id,month" });
  return error ? fail(error.code) : done();
}
