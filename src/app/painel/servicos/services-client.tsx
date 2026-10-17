"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { brl } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { saveService, toggleService, type R } from "./actions";

type S = { id: string; name: string; description: string | null; duration_minutes: number; buffer_minutes: number; price_cents: number; active: boolean };

export function ServicesClient({ services }: { services: S[] }) {
  const [editing, setEditing] = useState<S | "new" | null>(services.length === 0 ? "new" : null);
  const [, start] = useTransition();
  return (
    <div className="space-y-3">
      {services.map((s) => (
        <div key={s.id} className={`card flex items-center gap-3 ${s.active ? "" : "opacity-60"}`}>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{s.name}</p>
            <p className="text-sm text-muted">{s.duration_minutes} min{s.buffer_minutes ? ` + ${s.buffer_minutes} de intervalo` : ""} · {brl(s.price_cents)}</p>
          </div>
          <button onClick={() => setEditing(s)} className="btn btn-ghost px-3 py-2 text-xs">Editar</button>
          <button onClick={() => start(() => toggleService(s.id, !s.active).then(() => {}))} className="text-xs text-muted">{s.active ? "Pausar" : "Ativar"}</button>
        </div>
      ))}
      {editing ? <ServiceForm key={editing === "new" ? "new" : editing.id} s={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
        : <button onClick={() => setEditing("new")} className="btn btn-primary w-full sm:w-auto">+ Adicionar serviço</button>}
    </div>
  );
}

function ServiceForm({ s, onDone }: { s: S | null; onDone: () => void }) {
  const [state, action] = useActionState<R, FormData>(saveService, {});
  useEffect(() => { if (state.ok) onDone(); }, [state.ok, onDone]);
  return (
    <form action={action} className="card space-y-3">
      <input type="hidden" name="id" value={s?.id ?? ""} />
      <div><label className="label" htmlFor="name">Nome</label><input id="name" name="name" className="field" defaultValue={s?.name} placeholder="Ex.: Corte + barba" required /></div>
      <div><label className="label" htmlFor="description">Descrição (opcional)</label><input id="description" name="description" className="field" defaultValue={s?.description ?? ""} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label" htmlFor="duration">Duração</label><input id="duration" name="duration" type="number" min={5} step={5} className="field" defaultValue={s?.duration_minutes ?? 30} required /></div>
        <div><label className="label" htmlFor="buffer">Intervalo</label><input id="buffer" name="buffer" type="number" min={0} step={5} className="field" defaultValue={s?.buffer_minutes ?? 0} /></div>
        <div><label className="label" htmlFor="price">Preço R$</label><input id="price" name="price" inputMode="decimal" className="field" defaultValue={s ? (s.price_cents / 100).toFixed(2).replace(".", ",") : ""} /></div>
      </div>
      <p className="text-xs text-muted">Duração e intervalo em minutos.</p>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2"><SubmitButton className="btn btn-primary flex-1">Salvar</SubmitButton><button type="button" onClick={onDone} className="btn btn-ghost">Cancelar</button></div>
    </form>
  );
}
