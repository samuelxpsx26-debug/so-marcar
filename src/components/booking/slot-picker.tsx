"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDays, formatTime, localDate } from "@/lib/format";
import type { ResolvedTheme, Slot } from "./types";

type Props = {
  slug: string; serviceId: string; professionalId: string | null; timezone: string; maxDays: number; theme: ResolvedTheme;
  onPick: (slot: Slot) => void; selected?: Slot | null;
  /** Abre a lista de espera para o dia escolhido */
  onWaitlist?: (day: string) => void;
};

export function SlotPicker({ slug, serviceId, professionalId, timezone, maxDays, theme, onPick, selected, onWaitlist }: Props) {
  const today = localDate(new Date(), timezone);
  const days = useMemo(() => Array.from({ length: Math.min(maxDays, 30) + 1 }, (_, i) => addDays(today, i)), [today, maxDays]);
  const [day, setDay] = useState(today);
  const key = `${serviceId}|${professionalId ?? ""}|${day}`;
  const [loaded, setLoaded] = useState<{ key: string; slots: Slot[]; error: boolean } | null>(null);
  const current = loaded?.key === key ? loaded : null;
  const slots = current?.slots ?? null;
  const error = current?.error ?? false;

  useEffect(() => {
    let cancel = false;
    createClient().rpc("get_available_slots", { p_slug: slug, p_service: serviceId, p_date: day, p_professional: professionalId })
      .then(({ data, error }) => {
        if (cancel) return;
        // "Qualquer profissional": mostra cada horário uma vez, com o primeiro profissional livre
        const seen = new Set<string>();
        const unique = ((data ?? []) as Slot[]).filter((s) => (seen.has(s.starts_at) ? false : (seen.add(s.starts_at), true)));
        setLoaded({ key: `${serviceId}|${professionalId ?? ""}|${day}`, slots: unique, error: Boolean(error) });
      });
    return () => { cancel = true; };
  }, [slug, serviceId, professionalId, day]);

  const soft = theme.surface;
  const groups = (slots ?? []).reduce<Record<string, Slot[]>>((acc, s) => {
    const h = Number(formatTime(s.starts_at, timezone).slice(0, 2));
    const k = h < 12 ? "Manhã" : h < 18 ? "Tarde" : "Noite";
    (acc[k] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {days.map((d) => {
          const dt = new Date(`${d}T12:00:00Z`);
          const active = d === day;
          return (
            <button key={d} type="button" onClick={() => setDay(d)} className="flex w-14 shrink-0 flex-col items-center rounded-2xl py-2 text-sm transition"
              style={active ? { background: theme.primary, color: theme.onPrimary } : { background: soft }}>
              <span className="text-[11px] uppercase opacity-80">{d === today ? "hoje" : new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(dt).replace(".", "")}</span>
              <span className="text-lg font-bold">{dt.getUTCDate()}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm opacity-80">Não foi possível carregar os horários. Tente de novo.</p>}
      {slots === null && !error && <div className="grid grid-cols-4 gap-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-xl" style={{ background: soft }} />)}</div>}
      {slots?.length === 0 && (
        <div className="rounded-2xl p-4 text-center text-sm" style={{ background: soft }}>
          <p>Sem horários livres neste dia.</p>
          {onWaitlist
            ? <button type="button" onClick={() => onWaitlist(day)} className="mt-3 w-full rounded-xl py-3 font-bold" style={{ background: theme.primary, color: theme.onPrimary }}>Entrar na lista de espera</button>
            : <p className="opacity-75">Tente outro dia 👉</p>}
          {onWaitlist && <p className="mt-2 text-xs opacity-70">Se alguém desmarcar, você é avisado no WhatsApp.</p>}
        </div>
      )}
      {Object.entries(groups).map(([label, list]) => (
        <div key={label}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {list.map((s) => {
              const active = selected?.starts_at === s.starts_at;
              return (
                <button key={s.starts_at} type="button" onClick={() => onPick(s)} className="rounded-xl py-2.5 text-sm font-semibold transition active:scale-95"
                  style={active ? { background: theme.primary, color: theme.onPrimary } : { border: `1px solid ${theme.text}26` }}>
                  {formatTime(s.starts_at, timezone)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {onWaitlist && !!slots?.length && (
        <button type="button" onClick={() => onWaitlist(day)} className="w-full pt-1 text-center text-sm underline opacity-80">Nenhum horário serve? Entrar na lista de espera deste dia</button>
      )}
    </div>
  );
}
