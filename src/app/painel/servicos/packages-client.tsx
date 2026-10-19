"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { brl } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { HelpTip } from "@/components/help-tip";
import { savePackage, togglePackage, type R } from "./actions";

export type Pkg = { id: string; name: string; service_id: string; sessions: number; price_cents: number; valid_days: number | null; active: boolean };
type Svc = { id: string; name: string; price_cents: number; active: boolean };

const VALIDITY: [number, string][] = [[0, "Sem prazo"], [30, "30 dias"], [60, "60 dias"], [90, "90 dias"], [180, "6 meses"], [365, "1 ano"]];

/** Pacotes de sessões: "4 cortes por R$ 140" */
export function PackagesClient({ packages, services, ready }: { packages: Pkg[]; services: Svc[]; ready: boolean }) {
  const [editing, setEditing] = useState<Pkg | "new" | null>(null);
  const [, start] = useTransition();
  const svc = (id: string) => services.find((s) => s.id === id);
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Pacotes<HelpTip>Venda várias sessões de uma vez com desconto, como &quot;4 cortes por R$ 140&quot;. O cliente paga o pacote com você e, a cada visita, você toca em &quot;Usar pacote&quot; na agenda. Os pacotes aparecem na sua página com um botão para o cliente pedir pelo WhatsApp.</HelpTip></h2>
        <p className="text-sm text-muted">Garanta o retorno do cliente vendendo sessões antecipadas.</p>
      </div>
      {!ready && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Para usar pacotes, rode o arquivo supabase-fidelidade-pacotes.sql no Supabase.</p>}
      {packages.map((k) => {
        const s = svc(k.service_id);
        const full = s ? s.price_cents * k.sessions : 0;
        return (
          <div key={k.id} className={`card flex items-center gap-3 ${k.active ? "" : "opacity-60"}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{k.name}</p>
              <p className="text-sm text-muted">{k.sessions}× {s?.name ?? "serviço"} · {brl(k.price_cents)}{full > k.price_cents ? ` (economia de ${brl(full - k.price_cents)})` : ""}{k.valid_days ? ` · vale ${k.valid_days} dias` : ""}</p>
            </div>
            <button onClick={() => setEditing(k)} className="btn btn-ghost px-3 py-2 text-xs">Editar</button>
            <button onClick={() => start(() => togglePackage(k.id, !k.active).then(() => {}))} className="text-xs text-muted">{k.active ? "Pausar" : "Ativar"}</button>
          </div>
        );
      })}
      {editing ? <PackageForm key={editing === "new" ? "new" : editing.id} k={editing === "new" ? null : editing} services={services.filter((s) => s.active)} onDone={() => setEditing(null)} />
        : ready && services.some((s) => s.active) && <button onClick={() => setEditing("new")} className="btn btn-ghost w-full sm:w-auto">+ Criar pacote</button>}
    </section>
  );
}

function PackageForm({ k, services, onDone }: { k: Pkg | null; services: Svc[]; onDone: () => void }) {
  const [state, action] = useActionState<R, FormData>(savePackage, {});
  const [serviceId, setServiceId] = useState(k?.service_id ?? services[0]?.id ?? "");
  const [sessions, setSessions] = useState(String(k?.sessions ?? 4));
  const [price, setPrice] = useState(k ? (k.price_cents / 100).toFixed(2).replace(".", ",") : "");
  useEffect(() => { if (state.ok) onDone(); }, [state.ok, onDone]);
  const s = services.find((x) => x.id === serviceId);
  const full = (s?.price_cents ?? 0) * (Number(sessions) || 0);
  const cents = Math.round(Number(price.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  return (
    <form action={action} className="card space-y-3">
      <input type="hidden" name="id" value={k?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="pk-service">Serviço</label>
          <select id="pk-service" name="service_id" className="field" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {services.map((x) => <option key={x.id} value={x.id}>{x.name} · {brl(x.price_cents)}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="pk-name">Nome do pacote</label><input id="pk-name" name="name" className="field" defaultValue={k?.name ?? ""} placeholder={`Ex.: ${sessions || 4} ${s?.name.toLowerCase() ?? "sessões"}`} required /></div>
        <div><label className="label" htmlFor="pk-sessions">Sessões</label><input id="pk-sessions" name="sessions" type="number" min={2} max={100} className="field" value={sessions} onChange={(e) => setSessions(e.target.value)} required /></div>
        <div><label className="label" htmlFor="pk-price">Preço do pacote R$</label><input id="pk-price" name="price" inputMode="decimal" className="field" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={full ? (full * 0.85 / 100).toFixed(2).replace(".", ",") : ""} required /></div>
        <div><label className="label" htmlFor="pk-valid">Validade<HelpTip>Prazo para o cliente usar todas as sessões, contado a partir da compra. Depois disso, as sessões que sobraram não podem mais ser usadas.</HelpTip></label>
          <select id="pk-valid" name="valid_days" className="field" defaultValue={VALIDITY.some(([v]) => v === (k?.valid_days ?? 0)) ? k?.valid_days ?? 0 : 0}>
            {VALIDITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      {full > 0 && cents > 0 && <p className="text-xs text-muted">Avulso sairia {brl(full)}. {cents < full ? `O cliente economiza ${brl(full - cents)} (${Math.round((1 - cents / full) * 100)}%).` : "O pacote não está mais barato que o avulso."}</p>}
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2"><SubmitButton className="btn btn-primary flex-1">Salvar pacote</SubmitButton><button type="button" onClick={onDone} className="btn btn-ghost">Cancelar</button></div>
    </form>
  );
}
