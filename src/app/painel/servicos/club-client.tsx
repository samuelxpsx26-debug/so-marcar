"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { brl } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { HelpTip } from "@/components/help-tip";
import { clubSessionsLabel, type ClubPlan } from "@/lib/club";
import { saveClubPlan, toggleClubPlan, type R } from "./actions";

type Svc = { id: string; name: string; price_cents: number; active: boolean };

/** Clube mensal: "4 cortes por mês por R$ 120" */
export function ClubClient({ plans, services, ready, members }: { plans: ClubPlan[]; services: Svc[]; ready: boolean; members: Record<string, number> }) {
  const [editing, setEditing] = useState<ClubPlan | "new" | null>(null);
  const [, start] = useTransition();
  const names = (ids: string[]) => (ids.length === 0 ? "todos os serviços" : ids.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean).join(", "));
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Clube mensal<HelpTip tutorial="clube">O cliente paga uma mensalidade e pode vir até X vezes no mês, como &quot;4 cortes por mês por R$ 120&quot;. Você recebe a mensalidade direto (Pix ou dinheiro) e marca em Clientes. Na agenda, toque em &quot;Atendido pelo clube&quot; e o atendimento sai sem valor.</HelpTip></h2>
        <p className="text-sm text-muted">Receita garantida todo mês e cliente que volta sempre.</p>
      </div>
      {!ready && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Para usar o clube, rode o arquivo supabase-clube.sql no Supabase.</p>}
      {plans.map((k) => (
        <div key={k.id} className={`card flex items-center gap-3 ${k.active ? "" : "opacity-60"}`}>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{k.name}</p>
            <p className="text-sm text-muted">{brl(k.price_cents)}/mês · {clubSessionsLabel(k.sessions_per_month)} · {names(k.service_ids)}{members[k.id] ? ` · ${members[k.id]} ${members[k.id] === 1 ? "assinante" : "assinantes"}` : ""}</p>
          </div>
          <button onClick={() => setEditing(k)} className="btn btn-ghost px-3 py-2 text-xs">Editar</button>
          <button onClick={() => start(() => toggleClubPlan(k.id, !k.active).then(() => {}))} className="text-xs text-muted">{k.active ? "Pausar" : "Ativar"}</button>
        </div>
      ))}
      {editing ? <PlanForm key={editing === "new" ? "new" : editing.id} k={editing === "new" ? null : editing} services={services.filter((s) => s.active)} onDone={() => setEditing(null)} />
        : ready && services.some((s) => s.active) && <button onClick={() => setEditing("new")} className="btn btn-ghost w-full sm:w-auto">+ Criar plano do clube</button>}
    </section>
  );
}

function PlanForm({ k, services, onDone }: { k: ClubPlan | null; services: Svc[]; onDone: () => void }) {
  const [state, action] = useActionState<R, FormData>(saveClubPlan, {});
  const [picked, setPicked] = useState<string[]>(k?.service_ids ?? []);
  const [sessions, setSessions] = useState(String(k?.sessions_per_month ?? 4));
  const [price, setPrice] = useState(k ? (k.price_cents / 100).toFixed(2).replace(".", ",") : "");
  useEffect(() => { if (state.ok) onDone(); }, [state.ok, onDone]);
  const covered = picked.length ? services.filter((s) => picked.includes(s.id)) : services;
  const cheapest = covered.length ? Math.min(...covered.map((s) => s.price_cents)) : 0;
  const full = cheapest * (Number(sessions) || 0);
  const cents = Math.round(Number(price.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  return (
    <form action={action} className="card space-y-3">
      <input type="hidden" name="id" value={k?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3"><label className="label" htmlFor="cl-name">Nome do plano</label><input id="cl-name" name="name" className="field" defaultValue={k?.name ?? ""} placeholder="Ex.: Clube do corte" required /></div>
        <div><label className="label" htmlFor="cl-price">Mensalidade R$</label><input id="cl-price" name="price" inputMode="decimal" className="field" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="120,00" required /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="cl-sessions">Atendimentos por mês<HelpTip>Deixe 0 para ilimitado.</HelpTip></label><input id="cl-sessions" name="sessions" type="number" min={0} max={60} className="field" value={sessions} onChange={(e) => setSessions(e.target.value)} /></div>
      </div>
      <fieldset>
        <legend className="label">Serviços incluídos <span className="font-normal text-muted">(nenhum marcado = todos)</span></legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {services.map((s) => {
            const on = picked.includes(s.id);
            return (
              <label key={s.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}>
                <input type="checkbox" name="service_ids" value={s.id} checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== s.id) : [...picked, s.id])} className="sr-only" />
                {s.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      {full > 0 && cents > 0 && Number(sessions) > 0 && <p className="text-xs text-muted">Avulso, {sessions} atendimentos sairiam a partir de {brl(full)}. {cents < full ? `O cliente economiza até ${brl(full - cents)} por mês.` : "A mensalidade não está mais barata que o avulso."}</p>}
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2"><SubmitButton className="btn btn-primary flex-1">Salvar plano</SubmitButton><button type="button" onClick={onDone} className="btn btn-ghost">Cancelar</button></div>
    </form>
  );
}
