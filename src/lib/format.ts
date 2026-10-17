export const PLAN_PRICE_CENTS = 3790;
export const TRIAL_DAYS = 30;
export const BILLING_NOTICE_DAY = 25;

export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** R$ 37,90 / 30 dias = R$ 1,26 por dia (arredonda para cima, nunca promete menos do que cobra) */
export function pricePerDay(cents = PLAN_PRICE_CENTS, days = 30): string {
  return brl(Math.ceil(cents / days));
}

export function formatTime(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatDate(iso: string | Date, timeZone: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  const out = new Intl.DateTimeFormat("pt-BR", { timeZone, ...opts }).format(new Date(iso));
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Data local (YYYY-MM-DD) de um instante num fuso */
export function localDate(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts; // en-CA já sai como YYYY-MM-DD
}

/** Converte data+hora locais de um fuso para um instante UTC */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMinutes(new Date(guess), timeZone);
  const first = guess - offset * 60000;
  // Reaplica para acertar trocas de horário de verão
  const offset2 = tzOffsetMinutes(new Date(first), timeZone);
  return new Date(guess - offset2 * 60000);
}

function tzOffsetMinutes(d: Date, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - d.getTime()) / 60000);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function normalizePhone(p: string): string {
  const d = p.replace(/\D/g, "");
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

/** Dias inteiros que faltam até uma data (0 se já passou) */
export function daysUntil(iso: string | null | undefined, from = new Date()): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - from.getTime()) / 86_400_000));
}
