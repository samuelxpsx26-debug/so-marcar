"use client";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { addDays, brl, formatTime, localDate, waLink } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { confirmDeposit, spendPackageSession, spendClubSession, createAppointment, freeSlots, moveAppointment, setStatus, type ActionResult } from "./actions";
import { notify } from "@/lib/notify-client";
import { packageUsable, type CustomerPackage, type OpenPackage } from "@/lib/loyalty";
import { clubCovers, type ClubMember } from "@/lib/club";

export type AgendaAppt = {
  id: string; starts_at: string; ends_at: string; status: string; source: string; price_cents: number; notes: string | null;
  professional_id: string; service_id: string; rescheduled_from: string | null; manage_token?: string;
  deposit_cents?: number; deposit_status?: "none" | "awaiting" | "paid" | "waived"; deposit_due_at?: string | null;
  customer: { id: string; name: string; phone: string } | null;
  service: { name: string } | null;
};
type Pro = { id: string; name: string };
type Service = { id: string; name: string; duration_minutes: number; price_cents: number };
type Hour = { professional_id: string; weekday: number; start_time: string; end_time: string };

type Props = {
  view: "dia" | "semana" | "mes"; date: string; start: string; end: string; today: string; timezone: string;
  professionals: Pro[]; services: Service[]; hours: Hour[]; appointments: AgendaAppt[]; packages?: CustomerPackage[]; openPackages?: OpenPackage[]; clubMembers?: (ClubMember & { used: number })[];
};

const PX_PER_MIN = 1.4;
const statusStyle: Record<string, string> = {
  confirmed: "border-brand/30 bg-brand/10 text-ink",
  pending: "border-amber-300 bg-amber-50 text-ink",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-900",
  no_show: "border-red-300 bg-red-50 text-red-900 line-through",
};
const statusLabel: Record<string, string> = { confirmed: "Confirmado", pending: "Aguardando", completed: "Atendido", no_show: "Faltou", cancelled: "Cancelado" };

const awaitingDeposit = (a: AgendaAppt) => a.status === "pending" && a.deposit_status === "awaiting";
const label = (a: AgendaAppt) => (awaitingDeposit(a) ? "Aguardando sinal" : statusLabel[a.status]);

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const minutesInTz = (iso: string, tz: string) => toMin(formatTime(iso, tz));

export function AgendaClient(p: Props) {
  const [selected, setSelected] = useState<AgendaAppt | null>(null);
  const [creating, setCreating] = useState<{ pro?: string; time?: string; date: string } | null>(null);

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setCreating({ date: p.date })} className="btn btn-primary">+ Novo atendimento</button>
      </div>
      {p.view === "dia" && <DayView {...p} onSelect={setSelected} onCreate={(pro, time) => setCreating({ pro, time, date: p.date })} />}
      {p.view === "semana" && <WeekView {...p} onSelect={setSelected} />}
      {p.view === "mes" && <MonthView {...p} />}
      {selected && <ApptSheet a={selected} p={p} onClose={() => setSelected(null)} />}
      {creating && <NewSheet p={p} initial={creating} onClose={() => setCreating(null)} />}
    </>
  );
}

function DayView({ date, timezone, professionals, hours, appointments, onSelect, onCreate }: Props & { onSelect: (a: AgendaAppt) => void; onCreate: (pro: string, time: string) => void }) {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const todays = hours.filter((h) => h.weekday === dow);
  const dayStart = Math.min(8 * 60, ...todays.map((h) => toMin(h.start_time)));
  const dayEnd = Math.max(19 * 60, ...todays.map((h) => toMin(h.end_time)));
  const height = (dayEnd - dayStart) * PX_PER_MIN;
  const marks = Array.from({ length: Math.ceil((dayEnd - dayStart) / 60) + 1 }, (_, i) => dayStart - (dayStart % 60) + i * 60).filter((m) => m >= dayStart && m <= dayEnd);

  // Quem tem horário livre agora (útil para equipes)
  const freeNow = professionals.filter((pr) => {
    const nowMin = minutesInTz(new Date().toISOString(), timezone);
    const working = todays.some((h) => h.professional_id === pr.id && toMin(h.start_time) <= nowMin && toMin(h.end_time) > nowMin);
    const busy = appointments.some((a) => a.professional_id === pr.id && minutesInTz(a.starts_at, timezone) <= nowMin && minutesInTz(a.ends_at, timezone) > nowMin);
    return working && !busy;
  });

  return (
    <div className="space-y-3">
      {date === localDate(new Date(), timezone) && professionals.length > 1 && (
        <p className="text-sm text-muted">Livres agora: {freeNow.length ? freeNow.map((f) => <span key={f.id} className="mr-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-good">{f.name}</span>) : "ninguém"}</p>
      )}
      <div className="card overflow-x-auto p-0">
        <div className="flex min-w-full" style={{ minWidth: 64 + professionals.length * 170 }}>
          <div className="w-16 shrink-0 border-r border-line">
            <div className="h-11 border-b border-line" />
            <div className="relative" style={{ height }}>
              {marks.map((m) => (
                <span key={m} className="absolute right-2 -translate-y-2 text-[11px] text-muted" style={{ top: (m - dayStart) * PX_PER_MIN }}>{String(Math.floor(m / 60)).padStart(2, "0")}:00</span>
              ))}
            </div>
          </div>
          {professionals.map((pr) => {
            const ranges = todays.filter((h) => h.professional_id === pr.id);
            return (
              <div key={pr.id} className="min-w-[170px] flex-1 border-r border-line last:border-r-0">
                <div className="flex h-11 items-center justify-center border-b border-line px-2 text-sm font-semibold"><span className="truncate">{pr.name}</span></div>
                <div
                  className="relative cursor-pointer bg-zinc-100"
                  style={{ height }}
                  onClick={(e) => {
                    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                    const m = Math.floor((dayStart + y / PX_PER_MIN) / 15) * 15;
                    onCreate(pr.id, `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
                  }}
                >
                  {ranges.map((r, i) => (
                    <div key={i} className="absolute inset-x-0 bg-surface" style={{ top: (toMin(r.start_time) - dayStart) * PX_PER_MIN, height: (toMin(r.end_time) - toMin(r.start_time)) * PX_PER_MIN }} />
                  ))}
                  {marks.map((m) => <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ top: (m - dayStart) * PX_PER_MIN }} />)}
                  {appointments.filter((a) => a.professional_id === pr.id).map((a) => {
                    const s = minutesInTz(a.starts_at, timezone);
                    const e = minutesInTz(a.ends_at, timezone);
                    return (
                      <button
                        key={a.id}
                        onClick={(ev) => { ev.stopPropagation(); onSelect(a); }}
                        className={`absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs ${statusStyle[a.status] ?? statusStyle.confirmed}`}
                        style={{ top: (s - dayStart) * PX_PER_MIN, height: Math.max(22, (e - s) * PX_PER_MIN - 2) }}
                      >
                        <p className="truncate font-semibold">{formatTime(a.starts_at, timezone)} {a.customer?.name}</p>
                        <p className="truncate opacity-75">{awaitingDeposit(a) ? "aguardando sinal" : a.service?.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted">Toque num espaço em branco para encaixar um atendimento. Áreas cinza estão fora do expediente.</p>
    </div>
  );
}

function WeekView({ start, today, timezone, appointments, onSelect, professionals }: Props & { onSelect: (a: AgendaAppt) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const names = Object.fromEntries(professionals.map((pr) => [pr.id, pr.name]));
  return (
    <div className="grid gap-3 sm:grid-cols-7">
      {days.map((d) => {
        const list = appointments.filter((a) => localDate(new Date(a.starts_at), timezone) === d);
        return (
          <div key={d} className={`card p-3 ${d === today ? "ring-2 ring-brand" : ""}`}>
            <Link href={`/painel/agenda?v=dia&d=${d}`} className="block text-sm font-semibold capitalize">
              {new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))}
            </Link>
            <p className="text-xs text-muted">{list.length} {list.length === 1 ? "atendimento" : "atendimentos"}</p>
            <div className="mt-2 space-y-1.5">
              {list.map((a) => (
                <button key={a.id} onClick={() => onSelect(a)} className={`block w-full rounded-lg border px-2 py-1 text-left text-xs ${statusStyle[a.status] ?? ""}`}>
                  <span className="font-semibold">{formatTime(a.starts_at, timezone)}</span> {a.customer?.name}
                  {awaitingDeposit(a) && <span className="block text-[11px] font-medium text-amber-700">aguardando sinal</span>}
                  {professionals.length > 1 && <span className="block truncate opacity-70">{names[a.professional_id]}</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ start, end, today, timezone, appointments }: Props) {
  const firstDow = new Date(`${start}T12:00:00Z`).getUTCDay();
  const total = Math.round((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86_400_000);
  const counts = new Map<string, { n: number; v: number }>();
  for (const a of appointments) {
    const d = localDate(new Date(a.starts_at), timezone);
    const c = counts.get(d) ?? { n: 0, v: 0 };
    counts.set(d, { n: c.n + 1, v: c.v + (a.status === "no_show" ? 0 : a.price_cents) });
  }
  return (
    <div className="card p-3">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
        {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: total }, (_, i) => addDays(start, i)).map((d) => {
          const c = counts.get(d);
          return (
            <Link key={d} href={`/painel/agenda?v=dia&d=${d}`} className={`aspect-square rounded-xl border p-1.5 text-left text-xs sm:p-2 ${d === today ? "border-brand" : "border-line"} hover:bg-zinc-50`}>
              <span className="font-semibold">{Number(d.slice(8))}</span>
              {c && <span className="mt-1 block rounded-md bg-brand/10 px-1 text-[10px] font-semibold text-brand sm:text-xs">{c.n}<span className="hidden sm:inline"> · {brl(c.v)}</span></span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} className="text-2xl leading-none text-muted" aria-label="Fechar">×</button></div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ApptSheet({ a, p, onClose }: { a: AgendaAppt; p: Props; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveDate, setMoveDate] = useState(localDate(new Date(a.starts_at), p.timezone));
  const [slots, setSlots] = useState<{ professional_id: string; professional_name: string; starts_at: string }[] | null>(null);

  const run = (fn: () => Promise<ActionResult>) => start(async () => {
    const r = await fn();
    if (r.error) setError(r.error); else onClose();
  });

  useEffect(() => {
    if (!moving) return;
    let cancel = false;
    freeSlots(a.service_id, moveDate).then((s) => { if (!cancel) setSlots(s); });
    return () => { cancel = true; };
  }, [moving, moveDate, a.service_id]);

  const pkg = a.status !== "completed" && a.status !== "no_show" && !awaitingDeposit(a)
    ? (p.packages ?? []).find((k) => k.customer_id === a.customer?.id && k.service_id === a.service_id && packageUsable(k, new Date(a.starts_at)))
    : undefined;
  const club = a.status !== "completed" && a.status !== "no_show" && !awaitingDeposit(a) && !pkg
    ? (p.clubMembers ?? []).find((m) => m.customer_id === a.customer?.id && clubCovers(m, a.service_id))
    : undefined;
  const earlierToday = slots?.filter((s) => new Date(s.starts_at) < new Date(a.starts_at)) ?? [];
  const first = a.customer?.name.split(" ")[0] ?? "";

  return (
    <Sheet title={a.customer?.name ?? "Atendimento"} onClose={onClose}>
      <div className="space-y-1 text-sm">
        <p><strong>{formatTime(a.starts_at, p.timezone)}–{formatTime(a.ends_at, p.timezone)}</strong> · {a.service?.name} · {brl(a.price_cents)}</p>
        <p className="text-muted">{p.professionals.find((x) => x.id === a.professional_id)?.name} · {label(a)}{a.source === "public" ? " · veio pelo link" : ""}{a.rescheduled_from ? " · remarcado" : ""}</p>
        {a.notes && <p className="rounded-lg bg-zinc-50 p-2">{a.notes}</p>}
        {a.deposit_status === "paid" && !!a.deposit_cents && <p className="text-good">Sinal de {brl(a.deposit_cents)} pago · falta {brl(Math.max(a.price_cents - a.deposit_cents, 0))} no dia</p>}
      </div>

      {awaitingDeposit(a) && !moving && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Aguardando sinal de {brl(a.deposit_cents ?? 0)} no Pix</p>
          <p className="mt-0.5 text-amber-900">Confira no app do seu banco.{a.deposit_due_at ? ` Se não chegar até ${formatTime(a.deposit_due_at, p.timezone)}, o horário é liberado sozinho.` : ""}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled={pending} onClick={() => run(async () => { const r = await confirmDeposit(a.id); if (r.ok && a.manage_token) notify(a.manage_token); return r; })} className="btn col-span-2 bg-emerald-600 text-white">✓ Sinal recebido</button>
            {a.customer?.phone && a.manage_token && (
              <a target="_blank" href={waLink(a.customer.phone, `Oi, ${first}! Seu horário de ${formatTime(a.starts_at, p.timezone)} está reservado. Para confirmar, falta o sinal de ${brl(a.deposit_cents ?? 0)} no Pix. O código está aqui: ${window.location.origin}/reserva/${a.manage_token}`)} className="btn bg-[#25D366] px-3 text-xs text-white">Lembrar no WhatsApp</a>
            )}
            <button disabled={pending} onClick={() => confirm("Confirmar o horário sem cobrar o sinal?") && run(async () => { const r = await confirmDeposit(a.id, true); if (r.ok && a.manage_token) notify(a.manage_token); return r; })} className="btn btn-ghost px-3 text-xs">Dispensar sinal</button>
          </div>
        </div>
      )}

      {!moving ? (
        <div className="mt-5 grid grid-cols-2 gap-2">
          {pkg && (
            <button disabled={pending} onClick={() => run(() => spendPackageSession(a.id, pkg.id))} className="btn col-span-2 bg-violet-600 text-white">
              ✓ Atendido usando o pacote ({pkg.sessions_total - pkg.sessions_used} de {pkg.sessions_total} restantes)
            </button>
          )}
          {club && (
            <button disabled={pending} onClick={() => run(() => spendClubSession(a.id, club.id))} className="btn col-span-2 bg-violet-600 text-white">
              ✓ Atendido pelo clube{club.sessions_per_month ? ` (${Math.max(club.sessions_per_month - club.used, 0)} de ${club.sessions_per_month} no mês)` : ""}
            </button>
          )}
          <button disabled={pending} onClick={() => run(() => setStatus(a.id, "completed"))} className="btn bg-emerald-600 text-white">✓ Atendido</button>
          <button disabled={pending} onClick={() => run(() => setStatus(a.id, "no_show"))} className="btn btn-ghost text-bad">Faltou</button>
          <button disabled={pending} onClick={() => setMoving(true)} className="btn btn-ghost">Remarcar / adiantar</button>
          {a.customer?.phone && <a target="_blank" href={waLink(a.customer.phone, `Oi, ${first}! Sobre seu horário das ${formatTime(a.starts_at, p.timezone)}:`)} className="btn bg-[#25D366] text-white">WhatsApp</a>}
          <button disabled={pending} onClick={() => confirm("Cancelar este atendimento?") && run(() => setStatus(a.id, "cancelled"))} className="btn col-span-2 text-sm text-muted">Cancelar atendimento</button>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <label className="label" htmlFor="moveDate">Novo dia</label>
          <input id="moveDate" type="date" className="field" value={moveDate} min={p.today} onChange={(e) => { setSlots(null); setMoveDate(e.target.value); }} />
          {moveDate === localDate(new Date(a.starts_at), p.timezone) && earlierToday.length > 0 && (
            <p className="rounded-lg bg-emerald-50 p-2 text-sm text-good">Dá para adiantar: há {earlierToday.length} horários livres mais cedo neste dia.</p>
          )}
          {slots === null ? <p className="text-sm text-muted">Buscando horários…</p> : slots.length === 0 ? <p className="text-sm text-muted">Nenhum horário livre nesse dia.</p> : (
            <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
              {slots.map((s) => (
                <button key={s.professional_id + s.starts_at} disabled={pending} onClick={() => run(() => moveAppointment(a.id, s.starts_at, s.professional_id))} className="rounded-xl border border-line px-2 py-2 text-sm hover:border-brand">
                  <span className="font-semibold">{formatTime(s.starts_at, p.timezone)}</span>
                  {p.professionals.length > 1 && <span className="block truncate text-[11px] text-muted">{s.professional_name}</span>}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setMoving(false)} className="btn btn-ghost w-full">Voltar</button>
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-bad">{error}</p>}
    </Sheet>
  );
}

function NewSheet({ p, initial, onClose }: { p: Props; initial: { pro?: string; time?: string; date: string }; onClose: () => void }) {
  const [state, action] = useActionState<ActionResult, FormData>(createAppointment, {});
  const defaults = useMemo(() => initial, [initial]);
  useEffect(() => { if (state.ok) onClose(); }, [state.ok, onClose]);
  const open = (p.openPackages ?? []).filter((k) => p.services.some((s) => s.id === k.service_id));
  const [pkgId, setPkgId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(p.services[0]?.id ?? "");
  const pkg = open.find((k) => k.id === pkgId);
  const choosePackage = (id: string) => {
    setPkgId(id);
    const k = open.find((x) => x.id === id);
    if (k?.customer) { setName(k.customer.name); setPhone(k.customer.phone.replace(/^55(?=\d{10,11}$)/, "")); setServiceId(k.service_id); }
  };
  return (
    <Sheet title="Novo atendimento" onClose={onClose}>
      {open.length > 0 && (
        <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
          <label className="label" htmlFor="pkg">Atender cliente com pacote</label>
          <select id="pkg" className="field" value={pkgId} onChange={(e) => choosePackage(e.target.value)}>
            <option value="">Não, atendimento normal</option>
            {open.map((k) => <option key={k.id} value={k.id}>{k.customer?.name} · {k.name} ({k.sessions_total - k.sessions_used} de {k.sessions_total} restantes)</option>)}
          </select>
          {pkg && <p className="mt-2 text-xs text-violet-800">Depois do atendimento, toque nele na agenda e use &quot;Atendido usando o pacote&quot;. A sessão só é descontada nessa hora.</p>}
        </div>
      )}
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label" htmlFor="customerName">Cliente</label><input id="customerName" name="customerName" className="field" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="col-span-2"><label className="label" htmlFor="customerPhone">WhatsApp</label><input id="customerPhone" name="customerPhone" inputMode="tel" className="field" placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
          <div className="col-span-2">
            <label className="label" htmlFor="serviceId">Serviço</label>
            <select id="serviceId" name="serviceId" className="field" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
              {p.services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} min · {pkg?.service_id === s.id ? "pacote" : brl(s.price_cents)}</option>)}
            </select>
            {open.length === 0 && <p className="mt-1 text-xs text-muted">Pacotes não são um serviço: venda o pacote ao cliente em Clientes e ele aparece aqui para escolher.</p>}
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="professionalId">Profissional</label>
            <select id="professionalId" name="professionalId" className="field" defaultValue={defaults.pro} required>
              {p.professionals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="date">Dia</label><input id="date" name="date" type="date" className="field" defaultValue={defaults.date} required /></div>
          <div><label className="label" htmlFor="time">Hora</label><input id="time" name="time" type="time" step={300} className="field" defaultValue={defaults.time} required /></div>
          <div className="col-span-2"><label className="label" htmlFor="notes">Observação</label><input id="notes" name="notes" className="field" /></div>
        </div>
        {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-bad">{state.error}</p>}
        <SubmitButton>Salvar atendimento</SubmitButton>
      </form>
    </Sheet>
  );
}
