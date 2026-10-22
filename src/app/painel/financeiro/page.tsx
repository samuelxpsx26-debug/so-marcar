import type { Metadata } from "next";
import { getContext } from "@/lib/business";
import { localDate, zonedToUtc } from "@/lib/format";
import { computeFinance, monthRange, shiftMonth, type CommissionRule, type Expense, type FinAppt, type FixedExpense, type Payout } from "@/lib/finance";
import { FinanceView } from "./view";

export const metadata: Metadata = { title: "Financeiro" };

type ApptRow = {
  starts_at: string; status: string; price_cents: number; professional_id: string; service_id: string;
  customer_package_id: string | null; club_member_id: string | null; service: { price_cents: number } | null;
};

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { supabase, business, role } = await getContext();
  if (role !== "owner") return <div className="card text-sm text-muted">O financeiro (gastos, comissões e lucro) fica só com o dono do negócio.</div>;
  const tz = business.timezone;
  const today = localDate(new Date(), tz);
  const { m } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) && m <= today.slice(0, 7) ? m : today.slice(0, 7);
  const prev = shiftMonth(month, -1);
  const start = zonedToUtc(monthRange(prev).from, "00:00", tz).toISOString();
  const end = zonedToUtc(monthRange(month).to, "00:00", tz).toISOString();

  const appts: FinAppt[] = [];
  for (let i = 0; i < 20; i++) {
    const { data, error } = await supabase.from("appointments")
      .select("starts_at, status, price_cents, professional_id, service_id, customer_package_id, club_member_id, service:services(price_cents)")
      .eq("business_id", business.id).eq("status", "completed").gte("starts_at", start).lt("starts_at", end).order("starts_at").range(i * 1000, i * 1000 + 999);
    if (error || !data) break;
    for (const r of data as unknown as ApptRow[]) appts.push({
      startsAt: r.starts_at, status: r.status, priceCents: r.price_cents, servicePriceCents: r.service?.price_cents ?? 0,
      prepaid: !!(r.customer_package_id || r.club_member_id), professionalId: r.professional_id, serviceId: r.service_id,
    });
    if (data.length < 1000) break;
  }

  const [pros, services, rules, expenses, fixed, payouts, sales, dues] = await Promise.all([
    supabase.from("professionals").select("id, name, active").eq("business_id", business.id).order("sort_order"),
    supabase.from("services").select("id, name, price_cents, active").eq("business_id", business.id).order("sort_order"),
    supabase.from("commission_rules").select("professional_id, service_id, mode, value").eq("business_id", business.id),
    supabase.from("expenses").select("id, category, description, amount_cents, spent_on").eq("business_id", business.id).gte("spent_on", monthRange(prev).from).lt("spent_on", monthRange(month).to),
    supabase.from("fixed_expenses").select("id, category, description, amount_cents, starts_on, ends_on").eq("business_id", business.id).order("created_at"),
    supabase.from("commission_payouts").select("professional_id, month, amount_cents, paid_at").eq("business_id", business.id).gte("month", monthRange(prev).from),
    supabase.from("customer_packages").select("price_cents, created_at").eq("business_id", business.id).gte("created_at", start).lt("created_at", end),
    supabase.from("club_payments").select("amount_cents, paid_at").eq("business_id", business.id).gte("paid_at", start).lt("paid_at", end),
  ]);
  const ready = !rules.error && !expenses.error && !fixed.error;

  const base = {
    timeZone: tz, appts, pros: (pros.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    rules: (rules.data ?? []) as CommissionRule[], expenses: (expenses.data ?? []) as Expense[],
    fixed: (fixed.data ?? []) as FixedExpense[], payouts: (payouts.data ?? []) as Payout[],
    packageSales: ((sales.data ?? []) as { price_cents: number; created_at: string }[]).map((k) => ({ priceCents: k.price_cents, createdAt: k.created_at })),
    clubPayments: ((dues.data ?? []) as { amount_cents: number; paid_at: string }[]).map((k) => ({ priceCents: k.amount_cents, createdAt: k.paid_at })),
  };
  const cur = computeFinance({ ...base, month });
  const last = computeFinance({ ...base, month: prev });

  return (
    <FinanceView
      business={{ name: business.name }} month={month} today={today} ready={ready} f={cur}
      prevProfit={last.revenue || last.bills ? last.profit : null}
      pros={(pros.data ?? []) as { id: string; name: string; active: boolean }[]}
      services={(services.data ?? []) as { id: string; name: string; price_cents: number; active: boolean }[]}
      rules={base.rules} fixedAll={base.fixed}
    />
  );
}
