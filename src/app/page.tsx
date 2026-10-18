import { createClient as createAnonClient } from "@supabase/supabase-js";
import { BILLING_NOTICE_DAY, brl, pricePerDay, PLAN_PRICE_CENTS, TRIAL_DAYS } from "@/lib/format";
import { getPlan } from "@/lib/billing/plans";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/env";
import { Landing } from "@/components/landing/landing";
import { landingFonts } from "@/components/landing/fonts";
import { findNiche } from "@/components/landing/themes";

// ?nicho=barbearia (links de anúncio) já abre no tema do nicho, sem a pergunta
export default async function Home({ searchParams }: { searchParams: Promise<{ nicho?: string | string[] }> }) {
  const { nicho } = await searchParams;
  const niche = findNiche(Array.isArray(nicho) ? nicho[0] : nicho);
  // Preço e dias grátis vêm da tabela plans
  const plan = supabaseConfigured ? await getPlan(createAnonClient(SUPABASE_URL, SUPABASE_ANON_KEY)).catch(() => null) : null;
  const price = plan?.price_cents ?? PLAN_PRICE_CENTS;
  return (
    <div className={landingFonts}>
      <Landing
        initialNiche={niche?.id ?? null}
        priceLabel={brl(price)}
        perDayLabel={pricePerDay(price)}
        trialDays={plan?.trial_days ?? TRIAL_DAYS}
        noticeDay={BILLING_NOTICE_DAY}
        year={new Date().getFullYear()}
      />
    </div>
  );
}
