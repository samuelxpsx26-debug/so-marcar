// Clube mensal: o cliente paga uma mensalidade e usa até N atendimentos por mês.

export type ClubPlan = { id: string; name: string; price_cents: number; sessions_per_month: number | null; service_ids: string[]; active: boolean };

export type ClubMember = {
  id: string; customer_id: string; plan_id: string | null; name: string; price_cents: number;
  sessions_per_month: number | null; service_ids: string[]; status: "active" | "cancelled"; started_on: string; paid_until: string | null;
};

/** O plano cobre este serviço? (lista vazia = todos) */
export const clubCovers = (m: Pick<ClubMember, "service_ids">, serviceId: string) => m.service_ids.length === 0 || m.service_ids.includes(serviceId);

/** Situação da mensalidade num dia (YYYY-MM-DD local) */
export function clubStatus(m: Pick<ClubMember, "paid_until" | "status">, today: string): { kind: "cancelled" | "unpaid" | "overdue" | "due_soon" | "ok"; days: number } {
  if (m.status === "cancelled") return { kind: "cancelled", days: 0 };
  if (!m.paid_until) return { kind: "unpaid", days: 0 };
  const days = Math.round((Date.parse(`${m.paid_until}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return { kind: "overdue", days: Math.max(0, -days) };
  if (days <= 3) return { kind: "due_soon", days };
  return { kind: "ok", days };
}

/** "4 atendimentos por mês" / "ilimitado" */
export const clubSessionsLabel = (n: number | null) => (n ? `${n} ${n === 1 ? "atendimento" : "atendimentos"} por mês` : "atendimentos ilimitados");

/** Início do mês pago atual (vencimento menos 1 mês) */
export function clubPeriodStart(paidUntil: string) {
  const d = new Date(`${paidUntil}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

/** Atendimentos do clube no mês pago atual; `dayOf` converte o horário no dia local do negócio */
export function clubUsed(m: Pick<ClubMember, "id" | "paid_until">, appts: { club_member_id: string; starts_at: string }[], dayOf: (iso: string) => string) {
  if (!m.paid_until) return 0;
  const from = clubPeriodStart(m.paid_until);
  return appts.filter((a) => a.club_member_id === m.id && dayOf(a.starts_at) >= from && dayOf(a.starts_at) < m.paid_until!).length;
}
