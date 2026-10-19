import type { Metadata } from "next";
import { canManage, getContext } from "@/lib/business";
import { addDays, localDate, zonedToUtc } from "@/lib/format";
import { computeReport, monthlyRevenue, rangeFor } from "@/lib/reports";
import { loadReportAppts } from "@/lib/report-data";
import { ReportView } from "./view";

export const metadata: Metadata = { title: "Relatórios" };

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return <div className="card text-sm text-muted">Os relatórios ficam com o dono e os administradores do negócio.</div>;
  const tz = business.timezone;
  const { p = "mes" } = await searchParams;
  const now = new Date();
  const today = localDate(now, tz);
  const range = rangeFor(p, today);
  const sixMonths = `${addDays(`${today.slice(0, 8)}01`, -155).slice(0, 8)}01`;
  // Um ano antes do período para saber quem é cliente novo e quem voltou
  const since = addDays(range.from < sixMonths ? range.from : sixMonths, -365);
  const appts = await loadReportAppts(supabase, business.id, zonedToUtc(since, "00:00", tz).toISOString());
  const r = computeReport(appts, range, tz, now);
  const months = monthlyRevenue(appts, tz, now, 6);
  return <ReportView business={business} p={p} today={today} range={range} r={r} months={months} />;
}
