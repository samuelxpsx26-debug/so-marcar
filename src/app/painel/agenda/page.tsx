import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/business";
import { addDays, formatDate, localDate, zonedToUtc } from "@/lib/format";
import { AgendaClient, type AgendaAppt } from "./agenda-client";

export const metadata: Metadata = { title: "Agenda" };

type View = "dia" | "semana" | "mes";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ v?: string; d?: string; p?: string }> }) {
  const { supabase, business } = await getContext();
  const tz = business.timezone;
  const sp = await searchParams;
  const view: View = sp.v === "semana" || sp.v === "mes" ? sp.v : "dia";
  const today = localDate(new Date(), tz);
  const date = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today;

  // Intervalo da visão
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const start = view === "dia" ? date : view === "semana" ? addDays(date, -dow) : `${date.slice(0, 8)}01`;
  const end = view === "dia" ? addDays(date, 1) : view === "semana" ? addDays(start, 7) : (() => {
    const [y, m] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  })();

  const [{ data: pros }, { data: services }, { data: appts }, { data: hours }] = await Promise.all([
    supabase.from("professionals").select("id, name").eq("business_id", business.id).eq("active", true).order("sort_order").order("name"),
    supabase.from("services").select("id, name, duration_minutes, price_cents").eq("business_id", business.id).eq("active", true).order("sort_order").order("name"),
    supabase.from("appointments")
      .select("id, starts_at, ends_at, status, source, price_cents, notes, professional_id, service_id, rescheduled_from, customer:customers(id,name,phone), service:services(name)")
      .eq("business_id", business.id)
      .gte("starts_at", zonedToUtc(start, "00:00", tz).toISOString())
      .lt("starts_at", zonedToUtc(end, "00:00", tz).toISOString())
      .neq("status", "cancelled")
      .order("starts_at"),
    supabase.from("working_hours").select("professional_id, weekday, start_time, end_time").eq("business_id", business.id),
  ]);

  const step = view === "dia" ? 1 : view === "semana" ? 7 : 30;
  const prev = view === "mes" ? addDays(start, -1) : addDays(date, -step);
  const next = view === "mes" ? end : addDays(date, step);
  const link = (v: View, d: string) => `/painel/agenda?v=${v}&d=${d}${sp.p ? `&p=${sp.p}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted">
            {view === "mes" ? formatDate(`${start}T12:00:00Z`, "UTC", { month: "long", year: "numeric" })
              : view === "semana" ? `${formatDate(`${start}T12:00:00Z`, "UTC", { day: "numeric", month: "short" })} a ${formatDate(`${addDays(start, 6)}T12:00:00Z`, "UTC", { day: "numeric", month: "short" })}`
              : formatDate(`${date}T12:00:00Z`, "UTC")}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 text-sm">
          {(["dia", "semana", "mes"] as View[]).map((v) => (
            <Link key={v} href={link(v, date)} className={`rounded-lg px-3 py-1.5 font-medium ${view === v ? "bg-brand text-brand-ink" : "text-muted"}`}>
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href={link(view, prev)} className="btn btn-ghost px-3 py-2" aria-label="Anterior">‹</Link>
        <Link href={link(view, today)} className="btn btn-ghost px-3 py-2 text-xs">Hoje</Link>
        <Link href={link(view, next)} className="btn btn-ghost px-3 py-2" aria-label="Próximo">›</Link>
      </div>

      <AgendaClient
        view={view}
        date={date}
        start={start}
        end={end}
        today={today}
        timezone={tz}
        professionals={pros ?? []}
        services={services ?? []}
        hours={hours ?? []}
        appointments={(appts ?? []) as unknown as AgendaAppt[]}
      />
    </div>
  );
}
