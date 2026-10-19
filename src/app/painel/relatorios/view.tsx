import Link from "next/link";
import { addDays, brl, formatDate, waLink } from "@/lib/format";
import type { computeReport, monthlyRevenue, rangeFor } from "@/lib/reports";
import { HelpTip } from "@/components/help-tip";

const PERIODS = [["hoje", "Hoje"], ["7d", "7 dias"], ["mes", "Este mês"], ["mes-passado", "Mês passado"], ["90d", "90 dias"], ["ano", "No ano"]] as const;

export function ReportView({ business, p, today, range, r, months }: {
  business: { name: string; timezone: string }; p: string; today: string; range: ReturnType<typeof rangeFor>;
  r: ReturnType<typeof computeReport>; months: ReturnType<typeof monthlyRevenue>;
}) {
  const tz = business.timezone;
  const maxMonth = Math.max(1, ...months.map((m) => m.cents));
  const maxDay = Math.max(1, ...r.byWeekday.map((d) => d.count));
  const maxService = Math.max(1, ...r.services.map((s) => s.cents));
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios<HelpTip>Quanto você faturou, quais serviços mais vendem, quem são seus melhores clientes e quantas faltas teve. O faturamento soma só os atendimentos marcados como &quot;Atendido&quot; na agenda.</HelpTip></h1>
          <p className="text-sm text-muted">{range.label} · {formatDate(`${range.from}T12:00:00Z`, "UTC", { day: "numeric", month: "short" })}{addDays(range.to, -1) !== range.from && ` a ${formatDate(`${addDays(range.to, -1)}T12:00:00Z`, "UTC", { day: "numeric", month: "short" })}`}</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1 text-xs sm:flex sm:w-auto sm:text-sm">
          {PERIODS.map(([id, label]) => (
            <Link key={id} href={`/painel/relatorios?p=${id}`} className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-center font-medium sm:px-3 ${p === id || (!PERIODS.some(([x]) => x === p) && id === "mes") ? "bg-brand text-brand-ink" : "text-muted"}`}>{label}</Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Faturamento" value={brl(r.revenue)} hint={`${r.completed} ${r.completed === 1 ? "atendimento" : "atendimentos"}${r.packagesSold ? ` + ${r.packagesSold} ${r.packagesSold === 1 ? "pacote" : "pacotes"} (${brl(r.packagesCents)})` : ""}${r.clubPayments ? ` + ${r.clubPayments} ${r.clubPayments === 1 ? "mensalidade" : "mensalidades"} do clube (${brl(r.clubCents)})` : ""}`} />
        <Kpi label="Ticket médio" value={brl(r.avgTicket)} hint="por atendimento" />
        <Kpi label="Clientes atendidos" value={String(r.customers)} hint={`${r.newCustomers} ${r.newCustomers === 1 ? "novo" : "novos"} · ${r.returningCustomers} ${r.returningCustomers === 1 ? "voltou" : "voltaram"}`} />
        <Kpi label="Faltas" value={pct(r.noShowRate)} hint={r.noShows ? `${r.noShows} · ${brl(r.lostToNoShows)} perdidos` : "nenhuma falta"} bad={r.noShowRate > 0.1} />
      </div>

      {(r.unmarked > 0 || r.upcoming > 0) && (
        <div className="flex flex-wrap gap-3 text-sm">
          {r.unmarked > 0 && <Link href="/painel/agenda" className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900"><strong>{r.unmarked}</strong> {r.unmarked === 1 ? "atendimento passado sem marcar" : "atendimentos passados sem marcar"}. Marque na agenda para entrar no faturamento →</Link>}
          {r.upcoming > 0 && <span className="rounded-xl bg-violet-50 px-3 py-2 text-violet-900">Ainda vêm <strong>{r.upcoming}</strong> no período · até {brl(r.upcomingCents)}</span>}
        </div>
      )}

      <section className="card">
        <h2 className="font-bold">Faturamento por mês<HelpTip>Soma dos atendimentos marcados como &quot;Atendido&quot; em cada mês, nos últimos 6 meses.</HelpTip></h2>
        <div className="mt-4 flex h-44 items-end gap-2 sm:gap-4">
          {months.map((m) => (
            <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-semibold text-muted sm:text-xs">{m.cents ? brl(m.cents).replace(/,00$/, "") : ""}</span>
              <div className={`w-full max-w-14 rounded-t-lg ${m.key === today.slice(0, 7) ? "bg-brand" : "bg-brand/30"}`} style={{ height: `${Math.max(2, (m.cents / maxMonth) * 100)}%` }} title={`${m.count} atendimentos`} />
              <span className="text-xs capitalize text-muted">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="font-bold">Serviços que mais faturam</h2>
          {r.services.length === 0 ? <p className="mt-3 text-sm text-muted">Nenhum atendimento realizado no período.</p> : (
            <ul className="mt-3 space-y-3">
              {r.services.slice(0, 8).map((s) => (
                <li key={s.name} className="text-sm">
                  <div className="flex justify-between gap-2"><span className="truncate font-medium">{s.name}</span><span className="shrink-0 text-muted">{s.count}× · <strong className="text-ink">{brl(s.cents)}</strong></span></div>
                  <div className="mt-1 h-2 rounded-full bg-zinc-100"><div className="h-2 rounded-full bg-brand" style={{ width: `${(s.cents / maxService) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="font-bold">Dias mais movimentados<HelpTip>Quantos atendimentos você fez em cada dia da semana no período. Ajuda a decidir em que dia vale abrir mais horários ou fazer promoção.</HelpTip></h2>
          <div className="mt-4 flex h-36 items-end gap-2">
            {r.byWeekday.map((d) => (
              <div key={d.name} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs font-semibold text-muted">{d.count || ""}</span>
                <div className="w-full rounded-t-md bg-emerald-500/80" style={{ height: `${Math.max(2, (d.count / maxDay) * 100)}%` }} />
                <span className="text-xs text-muted">{d.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">{r.total ? `${pct(r.online / r.total)} das marcações vieram pelo seu link.` : ""}</p>
        </section>
      </div>

      {r.professionals.length > 1 && (
        <section className="card">
          <h2 className="font-bold">Por profissional</h2>
          <div className="mt-3 divide-y divide-line text-sm">
            {r.professionals.map((x) => <div key={x.name} className="flex justify-between py-2"><span>{x.name}</span><span className="text-muted">{x.count} atendimentos · <strong className="text-ink">{brl(x.cents)}</strong></span></div>)}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Clientes do período</h2>
        <a href="/painel/relatorios/clientes.csv" className="btn btn-ghost px-3 py-2 text-xs">Baixar planilha de clientes</a>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CustomerList title="Quem mais frequenta" help="Quem mais veio no período, contando os atendimentos marcados como “Atendido”. Bom para premiar a fidelidade." list={r.topVisitors} business={business} highlight="visits" />
        <CustomerList title="Quem mais gasta" help="Quem mais gastou com você no período. Um bom lugar para agradecer, oferecer um mimo ou um pacote." list={r.topCustomers} business={business} highlight="cents" />
      </div>
    </div>
  );
}

function CustomerList({ title, help, list, business, highlight }: {
  title: string; help: string; list: ReturnType<typeof computeReport>["topCustomers"]; business: { name: string; timezone: string }; highlight: "visits" | "cents";
}) {
  return (
    <section className="card">
      <h2 className="font-bold">{title}<HelpTip>{help}</HelpTip></h2>
      {list.length === 0 ? <p className="mt-3 text-sm text-muted">Nenhum atendimento realizado no período.</p> : (
        <div className="mt-3 divide-y divide-line">
          {list.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="w-5 text-center font-bold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block text-xs text-muted">{highlight === "visits" ? brl(c.cents) : `${c.visits} ${c.visits === 1 ? "visita" : "visitas"}`} · última {formatDate(c.last, business.timezone, { day: "numeric", month: "short" })}</span>
              </span>
              <strong className="shrink-0">{highlight === "visits" ? `${c.visits} ${c.visits === 1 ? "visita" : "visitas"}` : brl(c.cents)}</strong>
              {c.phone && <a target="_blank" href={waLink(c.phone, `Oi, ${c.name.split(" ")[0]}! Obrigado pela preferência aqui no ${business.name}.`)} className="rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-semibold text-white">WhatsApp</a>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value, hint, bad }: { label: string; value: string; hint: string; bad?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${bad ? "text-bad" : ""}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}
