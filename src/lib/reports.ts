// Relatórios do painel: tudo calculado a partir dos atendimentos, sem tabelas extras.
import { localDate } from "./format";

export type ReportAppt = {
  startsAt: string; status: string; source: string; priceCents: number;
  customerId: string; customerName: string; customerPhone: string; customerCreatedAt: string;
  serviceName: string; professionalName: string;
};

export type Range = { from: string; to: string }; // datas locais YYYY-MM-DD, "to" exclusivo

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function computeReport(all: ReportAppt[], range: Range, timeZone: string, now = new Date(), packageSales: { priceCents: number; createdAt: string }[] = []) {
  const day = (a: ReportAppt) => localDate(new Date(a.startsAt), timeZone);
  const inRange = all.filter((a) => day(a) >= range.from && day(a) < range.to && a.status !== "cancelled");
  const done = inRange.filter((a) => a.status === "completed");
  const noShows = inRange.filter((a) => a.status === "no_show");
  const unmarked = inRange.filter((a) => (a.status === "confirmed" || a.status === "pending") && new Date(a.startsAt) < now);
  const upcoming = inRange.filter((a) => (a.status === "confirmed" || a.status === "pending") && new Date(a.startsAt) >= now);
  const serviceRevenue = done.reduce((s, a) => s + a.priceCents, 0);
  // Pacotes entram no faturamento no dia da venda (as sessões usadas depois saem com valor zero)
  const sold = packageSales.filter((k) => { const d = localDate(new Date(k.createdAt), timeZone); return d >= range.from && d < range.to; });
  const packagesCents = sold.reduce((s, k) => s + k.priceCents, 0);
  const revenue = serviceRevenue + packagesCents;
  const finished = done.length + noShows.length;

  // Clientes: novos (primeira visita no período) x que voltaram (já tinham vindo antes)
  const firstVisit = new Map<string, string>();
  for (const a of all) {
    if (a.status !== "completed") continue;
    const d = day(a);
    if (!firstVisit.has(a.customerId) || d < firstVisit.get(a.customerId)!) firstVisit.set(a.customerId, d);
  }
  const served = new Set(done.map((a) => a.customerId));
  const newCustomers = [...served].filter((id) => (firstVisit.get(id) ?? "") >= range.from).length;

  const group = <K extends string>(list: ReportAppt[], key: (a: ReportAppt) => K) => {
    const m = new Map<K, { count: number; cents: number }>();
    for (const a of list) {
      const g = m.get(key(a)) ?? { count: 0, cents: 0 };
      m.set(key(a), { count: g.count + 1, cents: g.cents + a.priceCents });
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((x, y) => y.cents - x.cents || y.count - x.count);
  };

  const topCustomers = (() => {
    const m = new Map<string, { id: string; name: string; phone: string; visits: number; cents: number; last: string }>();
    for (const a of done) {
      const c = m.get(a.customerId) ?? { id: a.customerId, name: a.customerName, phone: a.customerPhone, visits: 0, cents: 0, last: a.startsAt };
      m.set(a.customerId, { ...c, visits: c.visits + 1, cents: c.cents + a.priceCents, last: a.startsAt > c.last ? a.startsAt : c.last });
    }
    return [...m.values()];
  })();
  const topSpenders = [...topCustomers].sort((x, y) => y.cents - x.cents || y.visits - x.visits).slice(0, 10);
  const topVisitors = [...topCustomers].sort((x, y) => y.visits - x.visits || (y.last > x.last ? 1 : -1)).slice(0, 10);

  // Movimento por dia da semana (atendimentos realizados)
  const byWeekday = WEEKDAYS.map((name, i) => ({ name, count: done.filter((a) => new Date(`${day(a)}T12:00:00Z`).getUTCDay() === i).length }));

  return {
    revenue,
    completed: done.length,
    serviceRevenue,
    packagesSold: sold.length,
    packagesCents,
    avgTicket: done.length ? Math.round(serviceRevenue / done.length) : 0,
    noShows: noShows.length,
    noShowRate: finished ? noShows.length / finished : 0,
    lostToNoShows: noShows.reduce((s, a) => s + a.priceCents, 0),
    unmarked: unmarked.length,
    upcoming: upcoming.length,
    upcomingCents: upcoming.reduce((s, a) => s + a.priceCents, 0),
    customers: served.size,
    newCustomers,
    returningCustomers: served.size - newCustomers,
    online: inRange.filter((a) => a.source === "public").length,
    total: inRange.length,
    services: group(done, (a) => a.serviceName),
    professionals: group(done, (a) => a.professionalName),
    topCustomers: topSpenders,
    topVisitors,
    byWeekday,
  };
}

/** Faturamento (atendimentos realizados) dos últimos N meses, do mais antigo ao atual */
export function monthlyRevenue(all: ReportAppt[], timeZone: string, now = new Date(), months = 6) {
  const cur = localDate(now, timeZone);
  const [y, m] = cur.split("-").map(Number);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1));
    const key = d.toISOString().slice(0, 7);
    const list = all.filter((a) => a.status === "completed" && localDate(new Date(a.startsAt), timeZone).startsWith(key));
    return {
      key,
      label: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(d).replace(".", ""),
      cents: list.reduce((s, a) => s + a.priceCents, 0),
      count: list.length,
    };
  });
}

/** Intervalo de cada período do seletor */
export function rangeFor(period: string, today: string): Range & { label: string } {
  const [y, m] = today.split("-").map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const next = iso(new Date(Date.UTC(y, m - 1, Number(today.slice(8)) + 1)));
  if (period === "hoje") return { from: today, to: next, label: "Hoje" };
  if (period === "7d") return { from: iso(new Date(Date.UTC(y, m - 1, Number(today.slice(8)) - 6))), to: next, label: "Últimos 7 dias" };
  if (period === "mes-passado") return { from: iso(new Date(Date.UTC(y, m - 2, 1))), to: iso(new Date(Date.UTC(y, m - 1, 1))), label: "Mês passado" };
  if (period === "90d") return { from: iso(new Date(Date.UTC(y, m - 1, Number(today.slice(8)) - 89))), to: next, label: "Últimos 90 dias" };
  if (period === "ano") return { from: `${y}-01-01`, to: next, label: `Em ${y}` };
  return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 1))), label: "Este mês" };
}
