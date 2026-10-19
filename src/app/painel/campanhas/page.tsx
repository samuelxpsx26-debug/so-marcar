import type { Metadata } from "next";
import { headers } from "next/headers";
import { getContext } from "@/lib/business";
import { lapsedCustomers, type CampaignCustomer } from "@/lib/campaign";
import { CampaignView } from "./view";
import type { Coupon } from "./coupons";

export const metadata: Metadata = { title: "Campanhas" };

const OPTIONS = [30, 45, 60, 90];

export default async function CampanhasPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { supabase, business } = await getContext();
  const { d } = await searchParams;
  const days = OPTIONS.includes(Number(d)) ? Number(d) : 45;
  const h = await headers();
  const bookingUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/${business.slug}`;

  // Paginado: o PostgREST devolve no máximo 1000 linhas por vez
  const all: CampaignCustomer[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data } = await supabase.from("customers").select("id, name, phone, marketing_consent, appointments(starts_at, status, price_cents)")
      .eq("business_id", business.id).order("created_at").range(from, from + 999);
    const rows = (data ?? []) as unknown as (Omit<CampaignCustomer, "consent"> & { marketing_consent: boolean })[];
    all.push(...rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, consent: r.marketing_consent, appointments: r.appointments })));
    if (rows.length < 1000) break;
  }
  const lapsed = lapsedCustomers(all, days);

  // Cupons (a tabela pode não existir antes do SQL de cupons)
  const [{ data: cps, error: cpErr }, { data: used }] = await Promise.all([
    supabase.from("coupons").select("id, code, kind, value, expires_on, max_uses, once_per_customer, active").eq("business_id", business.id).order("created_at", { ascending: false }),
    supabase.from("appointments").select("coupon_id").eq("business_id", business.id).not("coupon_id", "is", null).neq("status", "cancelled").limit(5000),
  ]);
  const uses = new Map<string, number>();
  for (const u of (used ?? []) as { coupon_id: string }[]) uses.set(u.coupon_id, (uses.get(u.coupon_id) ?? 0) + 1);
  const coupons = ((cps ?? []) as Omit<Coupon, "uses">[]).map((k) => ({ ...k, uses: uses.get(k.id) ?? 0 }));

  return <CampaignView businessId={business.id} businessName={business.name} bookingUrl={bookingUrl} days={days} options={OPTIONS} list={lapsed} coupons={coupons} couponsReady={!cpErr} />;
}
