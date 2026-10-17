import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getContext } from "@/lib/business";
import { addDays, brl, formatDate, formatTime, localDate, waLink, zonedToUtc } from "@/lib/format";
import { buildOpportunities, type CustomerVisit, type DayAppointment } from "@/lib/opportunities";
import { computeValue } from "@/lib/value";
import { OpportunityCard } from "./opportunity-card";

export const metadata: Metadata = { title: "Hoje" };

type ApptRow = {
  id: string; starts_at: string; ends_at: string; status: string; source: string; price_cents: number; rescheduled_from: string | null;
  customer: { id: string; name: string; phone: string } | null;
  service: { name: string } | null;
  professional: { name: string } | null;
};

export default async function HojePage({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const { supabase, business } = await getContext();
  const tz = business.timezone;
  const now = new Date();
  const today = localDate(now, tz);
  const tomorrow = addDays(today, 1);
  const monthStart = zonedToUtc(`${today.slice(0, 8)}01`, "00:00", tz);
  const dayStart = zonedToUtc(today, "00:00", tz);
  const tomorrowStart = zonedToUtc(tomorrow, "00:00", tz);
  const afterTomorrow = zonedToUtc(addDays(today, 2), "00:00", tz);
  const since = new Date(now.getTime() - 180 * 86_400_000);
  const h = await headers();
  const bookingUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/${business.slug}`;
  const { bemvindo } = await searchParams;

  const select = "id, starts_at, ends_at, status, source, price_cents, rescheduled_from, customer:customers(id,name,phone), service:services(name), professional:professionals(name)";
  const [{ data: recent }, { data: upcoming }, { data: sub }, { data: services }] = await Promise.all([
    supabase.from("appointments").select(select).eq("business_id", business.id).gte("starts_at", since.toISOString()).lt("starts_at", afterTomorrow.toISOString()).order("starts_at"),
    supabase.from("appointments").select("customer_id").eq("business_id", business.id).in("status", ["confirmed", "pending"]).gte("starts_at", now.toISOString()),
    supabase.from("subscriptions").select("status, trial_ends_at").eq("business_id", business.id).maybeSingle(),
    supabase.from("services").select("id, price_cents").eq("business_id", business.id).eq("active", true).order("sort_order").order("name"),
  ]);
  const appts = (recent ?? []) as unknown as ApptRow[];

  const firstService = services?.[0];
  const { data: freeSlots } = firstService
    ? await supabase.rpc("get_available_slots", { p_slug: business.slug, p_service: firstService.id, p_date: today })
    : { data: [] };
  const freeToday = Array.from(new Set(((freeSlots ?? []) as { starts_at: string }[]).map((s) => s.starts_at)));

  // Benefício financeiro do mês
  const monthAppts = appts.filter((a) => new Date(a.starts_at) >= monthStart);
  const value = computeValue(monthAppts.map((a) => ({ status: a.status, source: a.source, priceCents: a.price_cents, rescheduled: !!a.rescheduled_from, startsAt: a.starts_at })), now);

  // Clientes e ritmo de retorno
  const future = new Set((upcoming ?? []).map((u) => u.customer_id));
  const byCustomer = new Map<string, CustomerVisit>();
  for (const a of appts) {
    if (a.status !== "completed" || !a.customer) continue;
    const c = byCustomer.get(a.customer.id) ?? { id: a.customer.id, name: a.customer.name, phone: a.customer.phone, visits: [], avgTicketCents: 0, hasFutureBooking: future.has(a.customer.id) };
    c.visits.push(a.starts_at);
    c.avgTicketCents = Math.round((c.avgTicketCents * (c.visits.length - 1) + a.price_cents) / c.visits.length);
    byCustomer.set(c.id, c);
  }
  const completed = appts.filter((a) => a.status === "completed");
  const avgTicket = completed.length ? Math.round(completed.reduce((s, a) => s + a.price_cents, 0) / completed.length) : firstService?.price_cents ?? 0;

  const toDay = (a: ApptRow): DayAppointment => ({ id: a.id, customerName: a.customer?.name ?? "Cliente", customerPhone: a.customer?.phone ?? "", startsAt: a.starts_at, status: a.status, priceCents: a.price_cents });
  const active = (a: ApptRow) => a.status === "confirmed" || a.status === "pending";
  const todayList = appts.filter((a) => new Date(a.starts_at) >= dayStart && new Date(a.starts_at) < tomorrowStart && a.status !== "cancelled");
  const tomorrowList = appts.filter((a) => new Date(a.starts_at) >= tomorrowStart && new Date(a.starts_at) < afterTomorrow && active(a));
  const unresolved = appts.filter((a) => active(a) && new Date(a.ends_at) < now && new Date(a.starts_at) > new Date(now.getTime() - 14 * 86_400_000));

  const trialDaysLeft = sub?.status === "trialing" && sub.trial_ends_at ? Math.ceil((new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86_400_000) : null;

  const opportunities = buildOpportunities({
    now, businessName: business.name, bookingUrl, freeSlotsToday: freeToday, avgTicketCents: avgTicket,
    customers: [...byCustomer.values()], tomorrow: tomorrowList.map(toDay), unresolvedPast: unresolved.map(toDay), trialDaysLeft,
  });

  const todayRevenue = todayList.filter((a) => a.status !== "no_show").reduce((s, a) => s + a.price_cents, 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">{formatDate(now, tz)}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{bemvindo ? "Sua agenda está no ar! 🎉" : `${greeting(now, tz)}! Aqui está o seu dia.`}</h1>
        {bemvindo && (
          <p className="mt-2 text-muted">Compartilhe seu link na bio do Instagram e no WhatsApp: <a href={bookingUrl} className="font-semibold text-brand" target="_blank">{bookingUrl.replace(/^https?:\/\//, "")}</a></p>
        )}
      </div>

      {/* Benefício financeiro em destaque */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 to-fuchsia-600 p-6 text-white shadow-lg shadow-violet-300/40">
        <p className="text-sm font-medium text-white/80">O Só Marcar te trouxe este mês</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{brl(value.generated)}</p>
        <p className="mt-1 text-sm text-white/80">
          {value.roiMultiple >= 1 ? `${value.roiMultiple.toFixed(1).replace(".", ",")}x o valor da assinatura` : "Cada agendamento pelo link entra aqui"}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Stat label="pelo seu link" value={String(value.onlineBookings)} />
          <Stat label="salvos com remarcação" value={String(value.savedBookings)} />
          <Stat label="taxa de faltas" value={`${Math.round(value.noShowRate * 100)}%`} />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Oportunidades de Hoje</h2>
          <span className="text-xs text-muted">o que fazer agora</span>
        </div>
        {opportunities.length === 0 ? (
          <div className="card mt-3 text-sm text-muted">Tudo em dia por aqui. Quando surgir um horário vago ou um cliente sumido, aparece aqui.</div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {opportunities.map((o) => <OpportunityCard key={o.id} o={o} />)}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Agenda de hoje</h2>
          <span className="text-sm text-muted">{todayList.length} · {brl(todayRevenue)}</span>
        </div>
        <div className="card mt-3 divide-y divide-line p-0">
          {todayList.length === 0 && <p className="p-5 text-sm text-muted">Nenhum atendimento hoje ainda.</p>}
          {todayList.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-4">
              <div className="w-14 shrink-0 text-center"><p className="font-bold">{formatTime(a.starts_at, tz)}</p></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.customer?.name}</p>
                <p className="truncate text-sm text-muted">{a.service?.name} · {a.professional?.name}</p>
              </div>
              {a.customer?.phone && (
                <a className="btn btn-ghost px-3 py-2 text-xs" target="_blank" href={waLink(a.customer.phone, `Oi, ${a.customer.name.split(" ")[0]}! Te esperamos hoje às ${formatTime(a.starts_at, tz)}.`)}>WhatsApp</a>
              )}
            </div>
          ))}
        </div>
        <Link href="/painel/agenda" className="mt-3 inline-block text-sm font-semibold text-brand">Abrir agenda completa →</Link>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] leading-tight text-white/80">{label}</p>
    </div>
  );
}

function greeting(d: Date, tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(d));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
