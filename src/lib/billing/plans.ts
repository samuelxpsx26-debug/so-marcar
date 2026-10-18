import type { SupabaseClient } from "@supabase/supabase-js";

export type Plan = {
  id: string; name: string; price_cents: number; currency: string;
  billing_interval: "month" | "year"; trial_days: number; stripe_price_id: string | null;
};

export async function getPlan(db: SupabaseClient, id?: string | null): Promise<Plan | null> {
  const q = db.from("plans").select("id, name, price_cents, currency, billing_interval, trial_days, stripe_price_id").eq("active", true);
  const { data } = await (id ? q.eq("id", id) : q.eq("is_default", true)).maybeSingle();
  return (data as Plan | null) ?? null;
}
