import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/business";
import { addDays, formatDate, localDate, zonedToUtc } from "@/lib/format";
import { AgendaClient, type AgendaAppt } from "./agenda-client";
import { HelpTip } from "@/components/help-tip";
import { packageUsable, type CustomerPackage, type OpenPackage } from "@/lib/loyalty";
import { clubUsed, type ClubMember } from "@/lib/club";

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

  // Reservas com Pix vencido liberam o horário antes de montar a agenda
  await supabase.rpc("expire_unpaid_deposits", { p_business: business.id });
  const base = "id, starts_at, ends_at, status, source, price_cents, notes, professional_id, service_id, rescheduled_from, manage_token, customer:customers(id,name,phone), service:services(name)";
  const query = (cols: string) => supabase.from("appointments").select(cols)
    .eq("business_id", business.id)
    .gte("starts_at", zonedToUtc(start, "00:00", tz).toISOString())
    .lt("starts_at", zonedToUtc(end, "00:00", tz).toISOString())
    .neq("status", "cancelled")
    .order("starts_at");
  // Antes de rodar o SQL do sinal as colunas de sinal ainda não existem
  const loadAppts = async () => {
    const r = await query(`${base}, deposit_cents, deposit_status, deposit_due_at`);
    return r.error ? query(base) : r;
  };
  const [{ data: pros }, { data: services }, { data: appts }, { data: hours }] = await Promise.all([
    supabase.from("professionals").select("id, name").eq("business_id", business.id).eq("active", true).order("sort_order").order("name"),
    supabase.from("services").select("id, name, duration_minutes, price_cents").eq("business_id", business.id).eq("active", true).order("sort_order").order("name"),
    loadAppts(),
    supabase.from("working_hours").select("professional_id, weekday, start_time, end_time").eq("business_id", business.id),
  ]);

  // Pacotes dos clientes que aparecem na agenda (tabela pode não existir antes do SQL de pacotes)
  const ids = Array.from(new Set(((appts ?? []) as unknown as { customer: { id: string } | null }[]).map((a) => a.customer?.id).filter(Boolean))) as string[];
  const { data: pkgs } = ids.length
    ? await supabase.from("customer_packages").select("id, customer_id, service_id, name, sessions_total, sessions_used, price_cents, expires_at, created_at").eq("business_id", business.id).in("customer_id", ids.slice(0, 300))
    : { data: [] };

  // Pacotes com sessão sobrando, para escolher o cliente no "Novo atendimento"
  const { data: openPkgs } = await supabase.from("customer_packages")
    .select("id, customer_id, service_id, name, sessions_total, sessions_used, price_cents, expires_at, created_at, customer:customers(name, phone)")
    .eq("business_id", business.id).order("created_at", { ascending: false }).limit(500);
  const now = new Date();
  const openPackages = ((openPkgs ?? []) as unknown as OpenPackage[]).filter((k) => k.customer && packageUsable(k, now));

  // Clube mensal de quem aparece na agenda (tabela pode não existir antes do SQL do clube)
  const { data: members } = ids.length
    ? await supabase.from("club_members").select("id, customer_id, plan_id, name, price_cents, sessions_per_month, service_ids, status, started_on, paid_until").eq("business_id", business.id).eq("status", "active").in("customer_id", ids.slice(0, 300))
    : { data: [] };
  const memberIds = ((members ?? []) as ClubMember[]).map((m) => m.id);
  const { data: clubAppts } = memberIds.length
    ? await supabase.from("appointments").select("club_member_id, starts_at").in("club_member_id", memberIds).gte("starts_at", `${addDays(date, -62)}T00:00:00Z`)
    : { data: [] };
  const clubMembers = ((members ?? []) as ClubMember[]).map((m) => ({ ...m, used: clubUsed(m, (clubAppts ?? []) as { club_member_id: string; starts_at: string }[], (iso) => localDate(new Date(iso), tz)) }));

  const step = view === "dia" ? 1 : view === "semana" ? 7 : 30;
  const prev = view === "mes" ? addDays(start, -1) : addDays(date, -step);
  const next = view === "mes" ? end : addDays(date, step);
  const link = (v: View, d: string) => `/painel/agenda?v=${v}&d=${d}${sp.p ? `&p=${sp.p}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda<HelpTip tutorial="atendido">Todos os horários marcados, por dia e por profissional. Clique num horário para ver o cliente, confirmar, remarcar ou marcar falta. Você também pode bloquear horários por aqui.</HelpTip></h1>
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
        packages={(pkgs ?? []) as CustomerPackage[]}
        openPackages={openPackages}
        clubMembers={clubMembers}
      />
    </div>
  );
}
