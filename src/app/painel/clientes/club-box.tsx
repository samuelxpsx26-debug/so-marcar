"use client";
import { useState, useTransition } from "react";
import { brl, formatDate } from "@/lib/format";
import { clubSessionsLabel, clubStatus, type ClubMember, type ClubPlan } from "@/lib/club";
import { cancelClub, recordClubPayment, subscribeClub } from "./actions";

/** Clube mensal na ficha do cliente: assinar, receber mensalidade, ver uso do mês */
export function ClubBox({ customerId, member, used, plans, today }: { customerId: string; member: ClubMember | null; used: number; plans: ClubPlan[]; today: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => { setError(null); const r = await fn(); if (r.error) setError(r.error); });
  const day = (d: string) => formatDate(`${d}T12:00:00Z`, "UTC", { day: "numeric", month: "short" });

  if (!member) {
    if (plans.length === 0) return null;
    return (
      <form action={(f) => run(() => subscribeClub(f))} className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Clube mensal</p>
        <input type="hidden" name="customer_id" value={customerId} />
        <div className="flex gap-2">
          <select name="plan_id" aria-label="Plano do clube" className="field py-2 text-sm">{plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {brl(p.price_cents)}/mês</option>)}</select>
          <button disabled={pending} className="btn btn-ghost shrink-0 px-3 py-2 text-xs">Assinar clube</button>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="paid" defaultChecked /> Já recebi a 1ª mensalidade</label>
        {error && <p role="alert" className="text-bad">{error}</p>}
      </form>
    );
  }

  const st = clubStatus(member, today);
  const tone = st.kind === "ok" ? "bg-emerald-50 text-emerald-900" : st.kind === "due_soon" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-900";
  const label = st.kind === "unpaid" ? "Aguardando a 1ª mensalidade"
    : st.kind === "overdue" ? (st.days === 0 ? "Mensalidade vence hoje" : `Mensalidade atrasada há ${st.days} ${st.days === 1 ? "dia" : "dias"}`)
    : st.kind === "due_soon" ? `Mensalidade vence em ${st.days} ${st.days === 1 ? "dia" : "dias"} (${day(member.paid_until!)})`
    : `Em dia até ${day(member.paid_until!)}`;
  return (
    <div className="space-y-2 rounded-xl bg-violet-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-900">Clube mensal</p>
      <p className="font-semibold">{member.name} · {brl(member.price_cents)}/mês</p>
      <p className="text-sm text-muted">{member.sessions_per_month ? `${used} de ${member.sessions_per_month} atendimentos usados neste mês` : `${used} ${used === 1 ? "atendimento" : "atendimentos"} neste mês · ${clubSessionsLabel(null)}`}</p>
      <p className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${tone}`}>{label}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => { if (st.kind === "ok" && !confirm(`${member.name} já está em dia até ${day(member.paid_until!)}. Registrar mais um mês pago?`)) return; run(() => recordClubPayment(member.id)); }} className="btn btn-primary px-3 py-1.5 text-xs">Mensalidade recebida</button>
        <button type="button" disabled={pending} onClick={() => { if (confirm(`Cancelar o clube de ${member.name}? O cliente deixa de ter os atendimentos do plano.`)) run(() => cancelClub(member.id)); }} className="px-2 text-xs text-muted underline">Cancelar clube</button>
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
