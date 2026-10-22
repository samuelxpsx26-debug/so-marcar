// Financeiro do dono: lucro real do mês = faturamento − comissões − gastos fixos − gastos avulsos.
// Tudo calculado aqui a partir dos atendimentos e das tabelas de gastos; sem estado escondido.
import { localDate } from "./format";

export const EXPENSE_CATEGORIES = ["Aluguel", "Energia", "Água", "Internet", "Gasolina", "Comida para clientes", "Anúncios", "Produtos", "Manutenção", "Impostos", "Outros"] as const;

export type FinAppt = {
  startsAt: string; status: string; priceCents: number; servicePriceCents: number;
  /** atendimento coberto por pacote ou clube: o valor entrou na venda/mensalidade, a comissão usa o preço do serviço */
  prepaid: boolean;
  professionalId: string; serviceId: string;
};
export type CommissionRule = { professional_id: string; service_id: string | null; mode: "percent" | "fixed"; value: number };
export type Expense = { id: string; category: string; description: string | null; amount_cents: number; spent_on: string };
export type FixedExpense = { id: string; category: string; description: string | null; amount_cents: number; starts_on: string; ends_on: string | null };
export type Payout = { professional_id: string; month: string; amount_cents: number; paid_at: string };
export type Pro = { id: string; name: string };

/** "2026-10" -> { from: "2026-10-01", to: "2026-11-01" } (to exclusivo) */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 1))) };
}
export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** Gasto fixo vale no mês se começou até ele e não terminou antes dele */
export function fixedActiveIn(f: Pick<FixedExpense, "starts_on" | "ends_on">, month: string) {
  const first = `${month}-01`;
  return f.starts_on <= first && (!f.ends_on || f.ends_on >= first);
}

/** Regra que vale para o atendimento: a do serviço tem prioridade sobre a geral do profissional */
export function ruleFor(rules: CommissionRule[], professionalId: string, serviceId: string) {
  return rules.find((r) => r.professional_id === professionalId && r.service_id === serviceId)
    ?? rules.find((r) => r.professional_id === professionalId && r.service_id === null) ?? null;
}

/** Base da comissão: o valor cobrado; em atendimento de pacote/clube (cobrado antes), o preço do serviço */
export function commissionBase(a: FinAppt) {
  return a.prepaid && a.priceCents === 0 ? a.servicePriceCents : a.priceCents;
}

export function commissionFor(a: FinAppt, rule: CommissionRule | null) {
  if (!rule) return 0;
  return rule.mode === "percent" ? Math.round((commissionBase(a) * rule.value) / 10000) : rule.value;
}

export function computeFinance(input: {
  month: string; timeZone: string; appts: FinAppt[]; pros: Pro[]; rules: CommissionRule[];
  expenses: Expense[]; fixed: FixedExpense[]; payouts: Payout[];
  packageSales?: { priceCents: number; createdAt: string }[]; clubPayments?: { priceCents: number; createdAt: string }[];
}) {
  const { month, timeZone: tz } = input;
  const { from, to } = monthRange(month);
  const inMonth = (iso: string) => { const d = localDate(new Date(iso), tz); return d >= from && d < to; };

  const done = input.appts.filter((a) => a.status === "completed" && inMonth(a.startsAt));
  const serviceRevenue = done.reduce((s, a) => s + a.priceCents, 0);
  const packagesCents = (input.packageSales ?? []).filter((k) => inMonth(k.createdAt)).reduce((s, k) => s + k.priceCents, 0);
  const clubCents = (input.clubPayments ?? []).filter((k) => inMonth(k.createdAt)).reduce((s, k) => s + k.priceCents, 0);
  const revenue = serviceRevenue + packagesCents + clubCents;

  const names = new Map(input.pros.map((p) => [p.id, p.name]));
  const byPro = new Map<string, { professionalId: string; name: string; count: number; baseCents: number; commissionCents: number; hasRule: boolean }>();
  for (const a of done) {
    const rule = ruleFor(input.rules, a.professionalId, a.serviceId);
    const row = byPro.get(a.professionalId) ?? { professionalId: a.professionalId, name: names.get(a.professionalId) ?? "Profissional", count: 0, baseCents: 0, commissionCents: 0, hasRule: false };
    row.count += 1;
    row.baseCents += commissionBase(a);
    row.commissionCents += commissionFor(a, rule);
    row.hasRule ||= !!rule;
    byPro.set(a.professionalId, row);
  }
  const payouts = input.payouts.filter((p) => p.month.slice(0, 7) === month);
  const commissions = [...byPro.values()].map((r) => {
    const paid = payouts.find((p) => p.professional_id === r.professionalId);
    return { ...r, paidCents: paid?.amount_cents ?? null, paidAt: paid?.paid_at ?? null };
  }).sort((x, y) => y.commissionCents - x.commissionCents || x.name.localeCompare(y.name));
  const commissionTotal = commissions.reduce((s, r) => s + r.commissionCents, 0);

  const fixedList = input.fixed.filter((f) => fixedActiveIn(f, month));
  const fixedTotal = fixedList.reduce((s, f) => s + f.amount_cents, 0);
  const variableList = input.expenses.filter((e) => e.spent_on >= from && e.spent_on < to).sort((a, b) => (a.spent_on < b.spent_on ? 1 : -1));
  const variableTotal = variableList.reduce((s, e) => s + e.amount_cents, 0);

  const cat = new Map<string, number>();
  for (const e of [...fixedList, ...variableList]) cat.set(e.category, (cat.get(e.category) ?? 0) + e.amount_cents);
  const byCategory = [...cat.entries()].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents);

  const bills = fixedTotal + variableTotal;
  const profit = revenue - commissionTotal - bills;
  // Quanto de cada R$ 1 faturado sobra depois da comissão (sem dados, considera 100%)
  const keepRatio = revenue > 0 ? Math.max(0.05, 1 - commissionTotal / revenue) : 1;
  const breakEvenRevenue = Math.round(bills / keepRatio);
  const missingToBreakEven = Math.max(0, breakEvenRevenue - revenue);

  return {
    month, revenue, serviceRevenue, packagesCents, clubCents, completed: done.length,
    commissions, commissionTotal, fixedList, fixedTotal, variableList, variableTotal, byCategory,
    bills, profit, margin: revenue > 0 ? profit / revenue : 0, keepRatio, breakEvenRevenue, missingToBreakEven,
  };
}

/** Texto do resumo de comissão para mandar ao profissional pelo WhatsApp */
export function payoutMessage(p: { name: string; count: number; commissionCents: number }, monthLabel: string, business: string, brl: (c: number) => string) {
  const first = p.name.split(" ")[0];
  return `Oi, ${first}! Resumo da sua comissão de ${monthLabel} no ${business}: ${p.count} ${p.count === 1 ? "atendimento" : "atendimentos"}, total de ${brl(p.commissionCents)}. Obrigado pelo trabalho!`;
}

/** "1.234,56" / "1234.56" / "80" -> centavos (NaN se inválido) */
export function parseMoney(v: string): number {
  const s = v.trim().replace(/[R$\s]/g, "");
  if (!s) return NaN;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}
