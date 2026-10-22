import Link from "next/link";
import { brl } from "@/lib/format";
import { shiftMonth, type CommissionRule, type FixedExpense, type computeFinance } from "@/lib/finance";
import { HelpTip } from "@/components/help-tip";
import { CommissionBox, ExpenseBox, FixedBox } from "./boxes";

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const money = (c: number) => (c < 0 ? `− ${brl(-c)}` : brl(c));

export function FinanceView({ business, month, today, ready, f, prevProfit, pros, services, rules, fixedAll }: {
  business: { name: string }; month: string; today: string; ready: boolean; f: ReturnType<typeof computeFinance>; prevProfit: number | null;
  pros: { id: string; name: string; active: boolean }[]; services: { id: string; name: string; price_cents: number; active: boolean }[];
  rules: CommissionRule[]; fixedAll: FixedExpense[];
}) {
  const isCurrent = month === today.slice(0, 7);
  const label = monthLabel(month);
  const diff = prevProfit === null ? null : f.profit - prevProfit;
  const covered = f.bills === 0 ? 1 : Math.min(1, f.revenue / Math.max(1, f.breakEvenRevenue));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro<HelpTip>Quanto sobrou de verdade no mês: o faturamento dos atendimentos marcados como &quot;Atendido&quot; (mais pacotes e clube), menos as comissões da equipe, os gastos fixos e os gastos avulsos. Só você, dono, vê esta tela.</HelpTip></h1>
          <p className="text-sm text-muted">{cap(label)}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 text-sm">
          <Link href={`/painel/financeiro?m=${shiftMonth(month, -1)}`} className="rounded-lg px-3 py-1.5 font-medium text-muted" aria-label="Mês anterior">‹</Link>
          <span className="px-2 font-semibold">{cap(label.replace(/ de \d{4}$/, ""))}</span>
          {isCurrent ? <span className="px-3 py-1.5 text-zinc-300">›</span> : <Link href={`/painel/financeiro?m=${shiftMonth(month, 1)}`} className="rounded-lg px-3 py-1.5 font-medium text-muted" aria-label="Próximo mês">›</Link>}
        </div>
      </div>

      {!ready && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Para ativar o financeiro, rode o arquivo supabase-financeiro.sql no SQL Editor do Supabase.</p>}

      <section className="card">
        <p className="text-sm font-medium text-muted">Lucro real {isCurrent ? "até agora" : "no mês"}</p>
        <p className={`mt-1 text-4xl font-extrabold tracking-tight ${f.profit < 0 ? "text-bad" : "text-emerald-600"}`}>{money(f.profit)}</p>
        <p className="mt-1 text-xs text-muted">
          {f.revenue === 0 ? "Nenhum faturamento no mês ainda" : f.profit >= 0 ? `${Math.round(f.margin * 100)}% do que entrou ficou com você` : "As saídas estão maiores que as entradas no mês"}
          {diff !== null && ` · ${diff >= 0 ? "▲" : "▼"} ${brl(Math.abs(diff))} vs ${monthLabel(shiftMonth(month, -1)).replace(/ de \d{4}$/, "")}`}
        </p>
        <dl className="mt-4 divide-y divide-line text-sm">
          <Row label="Faturamento" value={f.revenue} hint={`${f.completed} ${f.completed === 1 ? "atendimento" : "atendimentos"}${f.packagesCents ? ` + pacotes ${brl(f.packagesCents)}` : ""}${f.clubCents ? ` + clube ${brl(f.clubCents)}` : ""}`} />
          <Row label="Comissões da equipe" value={-f.commissionTotal} />
          <Row label="Gastos fixos" value={-f.fixedTotal} hint={`${f.fixedList.length} ${f.fixedList.length === 1 ? "conta" : "contas"} do mês`} />
          <Row label="Gastos avulsos" value={-f.variableTotal} hint={`${f.variableList.length} ${f.variableList.length === 1 ? "lançamento" : "lançamentos"}`} />
          <div className="flex justify-between pt-3 font-bold"><dt>Lucro real</dt><dd className={f.profit < 0 ? "text-bad" : "text-emerald-600"}>{money(f.profit)}</dd></div>
        </dl>
      </section>

      {f.bills > 0 && (
        <section className="card">
          <h2 className="font-bold">Contas do mês<HelpTip>Quanto você precisa faturar no mês para pagar os gastos fixos e avulsos, já descontando a parte que vai para a comissão da equipe.</HelpTip></h2>
          <div className="mt-3 h-3 rounded-full bg-zinc-100"><div className={`h-3 rounded-full ${covered >= 1 ? "bg-emerald-500" : "bg-brand"}`} style={{ width: `${Math.max(3, covered * 100)}%` }} /></div>
          <p className="mt-2 text-sm">
            {f.missingToBreakEven > 0
              ? <>Faltam <strong>{brl(f.missingToBreakEven)}</strong> de faturamento para cobrir as contas de {brl(f.bills)}{isCurrent ? " deste mês" : ""}.</>
              : <>Contas do mês cobertas! A partir daqui, cerca de <strong>{Math.round(f.keepRatio * 100)}%</strong> de cada atendimento é lucro.</>}
          </p>
        </section>
      )}

      {f.byCategory.length > 0 && (
        <section className="card">
          <h2 className="font-bold">Para onde foi o dinheiro</h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            {f.byCategory.map((c) => (
              <li key={c.name}>
                <div className="flex justify-between gap-2"><span>{c.name}</span><strong>{brl(c.cents)}</strong></div>
                <div className="mt-1 h-2 rounded-full bg-zinc-100"><div className="h-2 rounded-full bg-rose-400" style={{ width: `${(c.cents / f.byCategory[0].cents) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExpenseBox ready={ready} month={month} today={today} list={f.variableList} />
        <FixedBox ready={ready} month={month} list={fixedAll} />
      </div>

      <CommissionBox ready={ready} month={month} monthLabel={label} business={business.name} rows={f.commissions} pros={pros} services={services} rules={rules} />
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt><span className="block">{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</dt>
      <dd className={`shrink-0 font-semibold ${value < 0 ? "text-bad" : ""}`}>{value < 0 ? `− ${brl(-value)}` : brl(value)}</dd>
    </div>
  );
}
