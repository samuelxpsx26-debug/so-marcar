"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import { HelpTip } from "@/components/help-tip";
import { brl, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES, payoutMessage, ruleFor, type CommissionRule, type Expense, type FixedExpense, type computeFinance } from "@/lib/finance";
import { addExpense, addFixed, deleteExpense, deleteFixed, endFixed, saveRule, setPaid, type R } from "./actions";

const short = (iso: string) => formatDate(`${iso.slice(0, 10)}T12:00:00Z`, "UTC", { day: "numeric", month: "short" });
const monthShort = (iso: string) => new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 7)}-15T12:00:00Z`)).replace(".", "");

function Categories({ name = "category" }: { name?: string }) {
  return (
    <select name={name} className="field" defaultValue="" required>
      <option value="" disabled>Escolha…</option>
      {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

/** Gastos avulsos do mês: gasolina, café, anúncio, produto... */
export function ExpenseBox({ ready, month, today, list }: { ready: boolean; month: string; today: string; list: Expense[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const total = list.reduce((s, e) => s + e.amount_cents, 0);
  return (
    <section className="card min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Gastos avulsos<HelpTip>Gastos que acontecem de vez em quando: gasolina, café ou lanche para clientes, um anúncio, produtos. Lance na hora, em poucos toques.</HelpTip></h2>
        {ready && !open && <button type="button" onClick={() => setOpen(true)} className="btn btn-primary shrink-0 px-3 py-2 text-xs">+ Lançar gasto</button>}
      </div>
      {open && <ExpenseForm defaultDay={today.startsWith(month) ? today : `${month}-01`} onDone={() => setOpen(false)} />}
      {list.length === 0 && !open && <p className="text-sm text-muted">Nenhum gasto avulso neste mês.</p>}
      <div className="divide-y divide-line">
        {list.map((e) => (
          <div key={e.id} className="flex items-center gap-2 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{e.category}{e.description ? ` · ${e.description}` : ""}</span>
              <span className="block text-xs text-muted">{short(e.spent_on)}</span>
            </span>
            <span className="shrink-0 text-right">
              <strong className="block">{brl(e.amount_cents)}</strong>
              <button type="button" disabled={pending} aria-label="Apagar gasto" onClick={() => { if (confirm("Apagar este gasto?")) start(async () => { await deleteExpense(e.id); }); }} className="text-xs text-muted underline">Apagar</button>
            </span>
          </div>
        ))}
      </div>
      {list.length > 1 && <p className="text-right text-sm text-muted">Total: <strong className="text-ink">{brl(total)}</strong></p>}
    </section>
  );
}

function ExpenseForm({ defaultDay, onDone }: { defaultDay: string; onDone: () => void }) {
  const [state, action] = useActionState<R, FormData>(addExpense, {});
  useEffect(() => { if (state.ok) onDone(); }, [state.ok, onDone]);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-line p-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="e-amount">Valor (R$)</label><input id="e-amount" name="amount" inputMode="decimal" className="field" placeholder="50,00" required autoFocus /></div>
        <div><label className="label" htmlFor="e-day">Data</label><input id="e-day" name="spent_on" type="date" className="field" defaultValue={defaultDay} required /></div>
        <div className="col-span-2"><label className="label" htmlFor="e-cat">Categoria</label><Categories /></div>
        <div className="col-span-2"><label className="label" htmlFor="e-desc">Descrição (opcional)</label><input id="e-desc" name="description" className="field" maxLength={120} placeholder="Ex.: café e água para clientes" /></div>
      </div>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2"><SubmitButton className="btn btn-primary flex-1">Salvar gasto</SubmitButton><button type="button" onClick={onDone} className="btn btn-ghost">Cancelar</button></div>
    </form>
  );
}

/** Gastos fixos: cadastrados uma vez, entram sozinhos em todo mês */
export function FixedBox({ ready, month, list }: { ready: boolean; month: string; list: FixedExpense[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const first = `${month}-01`;
  const active = list.filter((f) => !f.ends_on || f.ends_on >= first);
  const ended = list.filter((f) => f.ends_on && f.ends_on < first);
  const total = active.filter((f) => f.starts_on <= first).reduce((s, f) => s + f.amount_cents, 0);
  return (
    <section className="card min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Gastos fixos<HelpTip>Contas que se repetem todo mês, como aluguel, energia e internet. Você cadastra uma vez e elas entram sozinhas no cálculo de cada mês, até você parar.</HelpTip></h2>
        {ready && !open && <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost shrink-0 px-3 py-2 text-xs">+ Gasto fixo</button>}
      </div>
      {open && <FixedForm month={month} onDone={() => setOpen(false)} />}
      {active.length === 0 && !open && <p className="text-sm text-muted">Cadastre aluguel, energia, internet e outras contas do mês.</p>}
      <div className="divide-y divide-line">
        {active.map((f) => (
          <div key={f.id} className={`flex items-center gap-2 py-2.5 text-sm ${f.starts_on > first ? "opacity-60" : ""}`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{f.category}{f.description ? ` · ${f.description}` : ""}</span>
              <span className="block text-xs text-muted">{f.starts_on > first ? `começa em ${monthShort(f.starts_on)}` : `desde ${monthShort(f.starts_on)}`}{f.ends_on ? ` · até ${monthShort(f.ends_on)}` : " · todo mês"}</span>
            </span>
            <span className="shrink-0 text-right">
            <strong className="block">{brl(f.amount_cents)}<span className="text-xs font-normal text-muted">/mês</span></strong>
            <span className="flex justify-end gap-3">
            {!f.ends_on && f.starts_on <= first && <button type="button" disabled={pending} onClick={() => { if (confirm(`Parar de contar "${f.category}" a partir do mês que vem?`)) start(async () => { await endFixed(f.id, month); }); }} className="text-xs text-muted underline">Parar</button>}
            <button type="button" disabled={pending} onClick={() => { if (confirm("Apagar de todos os meses? Para só deixar de contar daqui pra frente, use Parar.")) start(async () => { await deleteFixed(f.id); }); }} className="text-xs text-muted underline">Apagar</button>
            </span>
            </span>
          </div>
        ))}
      </div>
      {total > 0 && <p className="text-right text-sm text-muted">Total no mês: <strong className="text-ink">{brl(total)}</strong></p>}
      {ended.length > 0 && <p className="text-xs text-muted">{ended.length} {ended.length === 1 ? "gasto encerrado" : "gastos encerrados"} antes deste mês.</p>}
    </section>
  );
}

function FixedForm({ month, onDone }: { month: string; onDone: () => void }) {
  const [state, action] = useActionState<R, FormData>(addFixed, {});
  useEffect(() => { if (state.ok) onDone(); }, [state.ok, onDone]);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-line p-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="f-amount">Valor por mês (R$)</label><input id="f-amount" name="amount" inputMode="decimal" className="field" placeholder="1.200,00" required autoFocus /></div>
        <div><label className="label" htmlFor="f-start">A partir de</label><input id="f-start" name="starts" type="month" className="field" defaultValue={month} required /></div>
        <div className="col-span-2"><label className="label" htmlFor="f-cat">Categoria</label><Categories /></div>
        <div className="col-span-2"><label className="label" htmlFor="f-desc">Descrição (opcional)</label><input id="f-desc" name="description" className="field" maxLength={120} placeholder="Ex.: aluguel do salão" /></div>
      </div>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2"><SubmitButton className="btn btn-primary flex-1">Salvar gasto fixo</SubmitButton><button type="button" onClick={onDone} className="btn btn-ghost">Cancelar</button></div>
    </form>
  );
}

const ruleText = (r: CommissionRule | null) => (!r ? "sem comissão definida" : r.mode === "percent" ? `${(r.value / 100).toLocaleString("pt-BR")}% do valor` : `${brl(r.value)} por atendimento`);

/** Comissões do mês por profissional + regras (geral e por serviço) */
export function CommissionBox({ ready, month, monthLabel, business, rows, pros, services, rules }: {
  ready: boolean; month: string; monthLabel: string; business: string; rows: ReturnType<typeof computeFinance>["commissions"];
  pros: { id: string; name: string; active: boolean }[]; services: { id: string; name: string; price_cents: number; active: boolean }[]; rules: CommissionRule[];
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const list = pros.filter((p) => p.active || rows.some((r) => r.professionalId === p.id));
  return (
    <section className="card min-w-0 space-y-3">
      <h2 className="font-bold">Comissões<HelpTip>A comissão é calculada sozinha a partir dos atendimentos marcados como &quot;Atendido&quot;. Defina para cada profissional uma % do valor ou um valor fixo por atendimento, e, se quiser, uma regra diferente para algum serviço. Em atendimentos de pacote ou clube, a comissão usa o preço do serviço.</HelpTip></h2>
      {list.length === 0 && <p className="text-sm text-muted">Cadastre a equipe em Equipe para calcular comissões.</p>}
      <div className="divide-y divide-line">
        {list.map((p) => {
          const r = rows.find((x) => x.professionalId === p.id);
          const general = rules.find((x) => x.professional_id === p.id && x.service_id === null) ?? null;
          const custom = rules.filter((x) => x.professional_id === p.id && x.service_id !== null).length;
          return (
            <div key={p.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-start gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block text-xs text-muted">{ruleText(general)}{custom ? ` · ${custom} ${custom === 1 ? "regra" : "regras"} por serviço` : ""}</span>
                  {r && <span className="block text-xs text-muted">{r.count} {r.count === 1 ? "atendimento" : "atendimentos"} · {brl(r.baseCents)} em serviços</span>}
                </span>
                <span className="text-right">
                  <strong className="block text-base">{brl(r?.commissionCents ?? 0)}</strong>
                  {r && r.commissionCents > 0 && (r.paidCents !== null
                    ? <span className="block text-xs font-medium text-emerald-700">Paga{r.paidAt ? ` em ${short(r.paidAt)}` : ""}{r.paidCents !== r.commissionCents ? ` (${brl(r.paidCents)})` : ""}</span>
                    : <span className="block text-xs font-medium text-amber-700">A pagar</span>)}
                </span>
              </div>
              {ready && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r && r.commissionCents > 0 && (r.paidCents === null
                    ? <button type="button" disabled={pending} onClick={() => start(async () => { await setPaid(p.id, month, r.commissionCents); })} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white">Marcar como paga</button>
                    : <button type="button" disabled={pending} onClick={() => start(async () => { await setPaid(p.id, month, null); })} className="rounded-lg border border-line px-2.5 py-1.5 text-xs">Desfazer pagamento</button>)}
                  {r && r.commissionCents > 0 && <a target="_blank" href={`https://wa.me/?text=${encodeURIComponent(payoutMessage({ name: p.name, count: r.count, commissionCents: r.commissionCents }, monthLabel, business, brl))}`} className="rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-semibold text-white">Enviar resumo</a>}
                  <button type="button" onClick={() => setEditing(editing === p.id ? null : p.id)} className="rounded-lg border border-line px-2.5 py-1.5 text-xs">{editing === p.id ? "Fechar" : "Definir comissão"}</button>
                </div>
              )}
              {editing === p.id && <RulesEditor proId={p.id} rules={rules} services={services} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RulesEditor({ proId, rules, services }: { proId: string; rules: CommissionRule[]; services: { id: string; name: string; price_cents: number; active: boolean }[] }) {
  const [showServices, setShowServices] = useState(rules.some((r) => r.professional_id === proId && r.service_id !== null));
  const general = rules.find((r) => r.professional_id === proId && r.service_id === null) ?? null;
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-line p-3">
      <RuleLine proId={proId} serviceId={null} label="Regra geral" rule={general} />
      <button type="button" onClick={() => setShowServices(!showServices)} className="text-xs font-medium text-brand underline">{showServices ? "Esconder regras por serviço" : "Regra diferente para algum serviço"}</button>
      {showServices && (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-xs text-muted">Deixe em branco para usar a regra geral.</p>
          {services.filter((s) => s.active).map((s) => (
            <RuleLine key={s.id} proId={proId} serviceId={s.id} label={`${s.name} · ${brl(s.price_cents)}`} rule={rules.find((r) => r.professional_id === proId && r.service_id === s.id) ?? null} fallback={ruleFor(rules, proId, "")} />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleLine({ proId, serviceId, label, rule, fallback }: { proId: string; serviceId: string | null; label: string; rule: CommissionRule | null; fallback?: CommissionRule | null }) {
  const [mode, setMode] = useState<"percent" | "fixed">(rule?.mode ?? fallback?.mode ?? "percent");
  const initial = rule ? (rule.mode === "percent" ? String(rule.value / 100).replace(".", ",") : (rule.value / 100).toFixed(2).replace(".", ",")) : "";
  const [value, setValue] = useState(initial);
  const [msg, setMsg] = useState<R>({});
  const [pending, start] = useTransition();
  const dirty = value !== initial || (rule && rule.mode !== mode);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{label}</p>
      <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[auto_1fr_auto]">
        <select aria-label="Tipo de comissão" value={mode} onChange={(e) => setMode(e.target.value as "percent" | "fixed")} className="field col-span-2 py-2 text-sm sm:col-span-1 sm:w-auto">
          <option value="percent">% do valor</option>
          <option value="fixed">R$ por atendimento</option>
        </select>
        <input aria-label="Valor da comissão" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={serviceId ? "usar a geral" : mode === "percent" ? "40" : "15,00"} className="field min-w-0 py-2 text-sm" />
        <button type="button" disabled={pending || !dirty} onClick={() => start(async () => { setMsg(await saveRule(proId, serviceId, mode, value)); })} className="btn btn-primary px-3 py-2 text-xs">{pending ? "…" : "Salvar"}</button>
      </div>
      {msg.error && <p className="text-xs text-bad">{msg.error}</p>}
      {msg.ok && !dirty && <p className="text-xs text-emerald-700">Salvo</p>}
    </div>
  );
}
