"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { formatDate, formatTime } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { addTimeOff, removeTimeOff, saveHours, saveProfessional, saveProServices, setProfessionalActive, type R } from "./actions";

type Pro = { id: string; name: string; bio: string | null; active: boolean };
type Hour = { professional_id: string; weekday: number; start_time: string; end_time: string };
type Off = { id: string; professional_id: string; starts_at: string; ends_at: string; reason: string | null };
type DayRow = { on: boolean; start: string; end: string; pause: boolean; pauseStart: string; pauseEnd: string };

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const hhmm = (t: string) => t.slice(0, 5);

function toRows(hours: Hour[]): DayRow[] {
  return DAYS.map((_, d) => {
    const r = hours.filter((h) => h.weekday === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (!r.length) return { on: false, start: "09:00", end: "18:00", pause: false, pauseStart: "12:00", pauseEnd: "13:00" };
    return {
      on: true, start: hhmm(r[0].start_time), end: hhmm(r[r.length - 1].end_time),
      pause: r.length > 1, pauseStart: r.length > 1 ? hhmm(r[0].end_time) : "12:00", pauseEnd: r.length > 1 ? hhmm(r[1].start_time) : "13:00",
    };
  });
}

function toRanges(rows: DayRow[]) {
  return rows.flatMap((r, weekday) => {
    if (!r.on) return [];
    if (r.pause && r.pauseStart > r.start && r.pauseEnd < r.end && r.pauseEnd > r.pauseStart) {
      return [{ weekday, start_time: r.start, end_time: r.pauseStart }, { weekday, start_time: r.pauseEnd, end_time: r.end }];
    }
    return [{ weekday, start_time: r.start, end_time: r.end }];
  });
}

export function TeamClient(p: { timezone: string; professionals: Pro[]; hours: Hour[]; services: { id: string; name: string }[]; links: { professional_id: string; service_id: string }[]; timeOff: Off[] }) {
  const [open, setOpen] = useState<string | null>(p.professionals[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      {p.professionals.map((pro) => (
        <div key={pro.id} className={`card p-0 ${pro.active ? "" : "opacity-60"}`}>
          <button onClick={() => setOpen(open === pro.id ? null : pro.id)} className="flex w-full items-center gap-3 p-5 text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 font-bold text-brand">{pro.name.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{pro.name}</span><span className="text-sm text-muted">{pro.active ? "Recebendo agendamentos" : "Pausado"}</span></span>
            <span className="text-muted">{open === pro.id ? "−" : "+"}</span>
          </button>
          {open === pro.id && <ProDetail pro={pro} {...p} />}
        </div>
      ))}
      {adding ? <NewPro onDone={() => setAdding(false)} /> : <button onClick={() => setAdding(true)} className="btn btn-primary w-full sm:w-auto">+ Adicionar profissional</button>}
    </div>
  );
}

function ProDetail({ pro, timezone, hours, services, links, timeOff }: { pro: Pro; timezone: string; hours: Hour[]; services: { id: string; name: string }[]; links: { professional_id: string; service_id: string }[]; timeOff: Off[] }) {
  const [rows, setRows] = useState(() => toRows(hours.filter((h) => h.professional_id === pro.id)));
  const linked = links.filter((l) => l.professional_id === pro.id).map((l) => l.service_id);
  const [svc, setSvc] = useState<string[]>(linked);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<DayRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const report = (r: R, ok: string) => setMsg(r.error ?? ok);

  return (
    <div className="space-y-6 border-t border-line p-5">
      <section>
        <h3 className="font-semibold">Horários e pausas</h3>
        <div className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={r.on} onChange={(e) => set(i, { on: e.target.checked })} className="h-4 w-4 accent-[var(--brand)]" /> {DAYS[i]}
              </label>
              {r.on && (
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <input type="time" value={r.start} onChange={(e) => set(i, { start: e.target.value })} className="field py-2" aria-label="Início" />
                    <span className="text-muted">até</span>
                    <input type="time" value={r.end} onChange={(e) => set(i, { end: e.target.value })} className="field py-2" aria-label="Fim" />
                  </div>
                  <label className="flex items-center gap-2 text-muted"><input type="checkbox" checked={r.pause} onChange={(e) => set(i, { pause: e.target.checked })} className="accent-[var(--brand)]" /> Pausa (almoço)</label>
                  {r.pause && (
                    <div className="flex items-center gap-2">
                      <input type="time" value={r.pauseStart} onChange={(e) => set(i, { pauseStart: e.target.value })} className="field py-2" aria-label="Início da pausa" />
                      <span className="text-muted">até</span>
                      <input type="time" value={r.pauseEnd} onChange={(e) => set(i, { pauseEnd: e.target.value })} className="field py-2" aria-label="Fim da pausa" />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <button disabled={pending} onClick={() => start(async () => report(await saveHours(pro.id, toRanges(rows)), "Horários salvos."))} className="btn btn-primary mt-3">Salvar horários</button>
      </section>

      {services.length > 0 && (
        <section>
          <h3 className="font-semibold">Serviços que faz</h3>
          <p className="text-xs text-muted">Sem nenhum marcado, faz todos.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {services.map((s) => {
              const on = svc.includes(s.id);
              return <button key={s.id} type="button" onClick={() => setSvc(on ? svc.filter((x) => x !== s.id) : [...svc, s.id])} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand bg-brand/10 text-brand" : "border-line"}`}>{s.name}</button>;
            })}
          </div>
          <button disabled={pending} onClick={() => start(async () => report(await saveProServices(pro.id, svc), "Serviços salvos."))} className="btn btn-ghost mt-3">Salvar serviços</button>
        </section>
      )}

      <section>
        <h3 className="font-semibold">Folgas, férias e bloqueios</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {timeOff.filter((t) => t.professional_id === pro.id).map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
              <span>{formatDate(t.starts_at, timezone, { day: "numeric", month: "short" })} {formatTime(t.starts_at, timezone)} → {formatDate(t.ends_at, timezone, { day: "numeric", month: "short" })} {formatTime(t.ends_at, timezone)}{t.reason ? ` · ${t.reason}` : ""}</span>
              <button onClick={() => start(async () => { await removeTimeOff(t.id); })} className="text-xs text-bad">Remover</button>
            </li>
          ))}
        </ul>
        <TimeOffForm proId={pro.id} />
      </section>

      <div className="flex items-center justify-between border-t border-line pt-4">
        <EditName pro={pro} />
        <button onClick={() => start(async () => { await setProfessionalActive(pro.id, !pro.active); })} className="text-sm text-muted">{pro.active ? "Pausar profissional" : "Reativar"}</button>
      </div>
      {msg && <p role="status" className="text-sm text-good">{msg}</p>}
    </div>
  );
}

function TimeOffForm({ proId }: { proId: string }) {
  const [state, action] = useActionState<R, FormData>(addTimeOff, {});
  return (
    <form action={action} className="mt-3 grid grid-cols-2 gap-2 text-sm">
      <input type="hidden" name="professionalId" value={proId} />
      <input name="startDate" type="date" className="field py-2" aria-label="Data inicial" required />
      <input name="startTime" type="time" defaultValue="00:00" className="field py-2" aria-label="Hora inicial" required />
      <input name="endDate" type="date" className="field py-2" aria-label="Data final" required />
      <input name="endTime" type="time" defaultValue="23:59" className="field py-2" aria-label="Hora final" required />
      <input name="reason" placeholder="Motivo (opcional)" className="field col-span-2 py-2" />
      {state.error && <p className="col-span-2 text-bad">{state.error}</p>}
      <SubmitButton className="btn btn-ghost col-span-2">Bloquear período</SubmitButton>
    </form>
  );
}

function EditName({ pro }: { pro: Pro }) {
  const [state, action] = useActionState<R, FormData>(saveProfessional, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={pro.id} />
      <input name="name" defaultValue={pro.name} className="field py-2 text-sm" aria-label="Nome" />
      <SubmitButton className="btn btn-ghost px-3 py-2 text-xs">Renomear</SubmitButton>
      {state.error && <span className="text-xs text-bad">{state.error}</span>}
    </form>
  );
}

function NewPro({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState<R, FormData>(saveProfessional, {});
  useEffect(() => { if (state.ok) onDone(); }, [state.ok, onDone]);
  return (
    <form action={action} className="card space-y-3">
      <div><label className="label" htmlFor="pname">Nome do profissional</label><input id="pname" name="name" className="field" required /></div>
      <div><label className="label" htmlFor="pbio">Especialidade (opcional)</label><input id="pbio" name="bio" className="field" placeholder="Ex.: Especialista em degradê" /></div>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2"><SubmitButton className="btn btn-primary flex-1">Adicionar</SubmitButton><button type="button" onClick={onDone} className="btn btn-ghost">Cancelar</button></div>
    </form>
  );
}
