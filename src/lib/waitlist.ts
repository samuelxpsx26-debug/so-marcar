import type { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/format";
import type { WaitlistOpening } from "@/lib/opportunities";

export type Period = "qualquer" | "manha" | "tarde" | "noite";
export const PERIOD_LABEL: Record<Period, string> = { qualquer: "Qualquer horário", manha: "Manhã", tarde: "Tarde", noite: "Noite" };

export type WaitlistEntry = {
  id: string; desired_date: string; period: Period; status: "waiting" | "notified"; note: string | null;
  created_at: string; notified_at: string | null; service_id: string; professional_id: string | null;
  customer: { name: string; phone: string } | null;
  service: { name: string; price_cents: number } | null;
  professional: { name: string } | null;
};

/** O horário (HH:MM no fuso do negócio) cai no período que o cliente pediu? */
export function inPeriod(time: string, period: Period) {
  const h = Number(time.slice(0, 2));
  if (period === "manha") return h < 12;
  if (period === "tarde") return h >= 12 && h < 18;
  if (period === "noite") return h >= 18;
  return true;
}

/** Horários livres (únicos, em ordem) que servem para o período pedido */
export function openTimes(slots: { starts_at: string }[], period: Period, timeZone: string) {
  const times = Array.from(new Set(slots.map((s) => s.starts_at))).sort().map((s) => formatTime(s, timeZone));
  return Array.from(new Set(times)).filter((t) => inPeriod(t, period));
}

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Pedidos ativos da lista de espera e, para cada um, os horários que abriram.
 * Se a tabela ainda não existir no banco, devolve vazio sem quebrar o painel.
 */
export async function loadWaitlist(supabase: Db, business: { id: string; slug: string; timezone: string }, today: string) {
  const { data, error } = await supabase
    .from("waitlist_entries")
    .select("id, desired_date, period, status, note, created_at, notified_at, service_id, professional_id, customer:customers(name,phone), service:services(name,price_cents), professional:professionals(name)")
    .eq("business_id", business.id)
    .in("status", ["waiting", "notified"])
    .gte("desired_date", today)
    .order("desired_date")
    .order("created_at")
    .limit(200);
  if (error || !data) return { entries: [] as WaitlistEntry[], open: new Map<string, string[]>() };
  const entries = data as unknown as WaitlistEntry[];

  // Uma consulta de horários por (serviço, dia, profissional)
  const keys = Array.from(new Set(entries.map((e) => `${e.service_id}|${e.desired_date}|${e.professional_id ?? ""}`)));
  const slotsByKey = new Map<string, { starts_at: string }[]>();
  await Promise.all(keys.slice(0, 30).map(async (k) => {
    const [service, date, pro] = k.split("|");
    const { data: slots } = await supabase.rpc("get_available_slots", { p_slug: business.slug, p_service: service, p_date: date, p_professional: pro || null });
    slotsByKey.set(k, (slots ?? []) as { starts_at: string }[]);
  }));

  const open = new Map<string, string[]>();
  for (const e of entries) {
    const slots = slotsByKey.get(`${e.service_id}|${e.desired_date}|${e.professional_id ?? ""}`) ?? [];
    open.set(e.id, openTimes(slots, e.period, business.timezone));
  }
  return { entries, open };
}

/** "hoje", "amanhã" ou "na quarta, 22/10" */
export function dayLabel(date: string, today: string, tomorrow: string) {
  if (date === today) return "hoje";
  if (date === tomorrow) return "amanhã";
  const label = formatDate(`${date}T12:00:00Z`, "UTC", { weekday: "long", day: "2-digit", month: "2-digit" }).toLowerCase();
  return `${/^(sábado|domingo)/.test(label) ? "no" : "na"} ${label}`;
}

/** Quem ainda não foi avisado e já tem horário livre vira oportunidade em "Hoje" */
export function waitlistOpenings(entries: WaitlistEntry[], open: Map<string, string[]>, today: string, tomorrow: string): WaitlistOpening[] {
  return entries
    .filter((e) => e.status === "waiting" && e.customer && (open.get(e.id)?.length ?? 0) > 0)
    .map((e) => ({
      entryId: e.id, name: e.customer!.name, phone: e.customer!.phone, serviceName: e.service?.name ?? "o serviço",
      dateLabel: dayLabel(e.desired_date, today, tomorrow), times: open.get(e.id)!, priceCents: e.service?.price_cents ?? 0,
    }));
}
