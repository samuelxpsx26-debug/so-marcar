// Benefício financeiro mostrado no painel inicial. Só soma o que dá para provar com dados.
import { PLAN_PRICE_CENTS } from "./format";

export type PeriodAppointment = { status: string; source: string; priceCents: number; rescheduled: boolean; startsAt: string };

export function computeValue(appts: PeriodAppointment[], now = new Date()) {
  const counted = appts.filter((a) => a.status === "completed" || (a.status === "confirmed" && new Date(a.startsAt) > now));
  const online = counted.filter((a) => a.source === "public");
  const saved = counted.filter((a) => a.rescheduled);
  const onlineRevenue = online.reduce((s, a) => s + a.priceCents, 0);
  const savedRevenue = saved.reduce((s, a) => s + a.priceCents, 0);
  const completedRevenue = appts.filter((a) => a.status === "completed").reduce((s, a) => s + a.priceCents, 0);
  const noShows = appts.filter((a) => a.status === "no_show").length;
  const finished = appts.filter((a) => a.status === "completed" || a.status === "no_show").length;
  const generated = onlineRevenue + savedRevenue;
  return {
    onlineBookings: online.length,
    onlineRevenue,
    savedBookings: saved.length,
    savedRevenue,
    completedRevenue,
    noShows,
    noShowRate: finished ? noShows / finished : 0,
    generated,
    roiMultiple: generated / PLAN_PRICE_CENTS,
  };
}
