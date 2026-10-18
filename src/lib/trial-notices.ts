import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import { BILLING_NOTICE_DAY, brl } from "@/lib/format";
import { renderTrialNotice } from "@/lib/email-templates";
import { emailConfigured, sendEmail } from "@/lib/notifications";

type Row = {
  id: string; business_id: string; trial_ends_at: string; price_cents: number; provider_subscription_id: string | null;
  plan: { trial_days: number } | null;
  business: { name: string; timezone: string } | null;
};

/**
 * Aviso de cobrança: no dia BILLING_NOTICE_DAY do teste (5 dias antes do fim, num teste de 30)
 * o dono recebe um e-mail dizendo quando e quanto será cobrado. Uma vez por negócio.
 */
export async function sendTrialNotices() {
  const summary = { sent: 0, failed: 0, skipped: 0 };
  if (!emailConfigured()) return { ...summary, configured: false };
  const db = createServiceClient();
  const now = Date.now();

  // Busca quem termina o teste nos próximos 10 dias e filtra pelo dia do aviso de cada plano
  const { data, error } = await db.from("subscriptions")
    .select("id, business_id, trial_ends_at, price_cents, provider_subscription_id, plan:plans(trial_days), business:businesses(name, timezone)")
    .eq("status", "trialing").eq("cancel_at_period_end", false)
    .gt("trial_ends_at", new Date(now).toISOString())
    .lte("trial_ends_at", new Date(now + 10 * 86_400_000).toISOString());
  if (error) throw new Error(`trial notices: ${error.message}`);

  for (const s of (data ?? []) as unknown as Row[]) {
    const leadDays = Math.max(1, (s.plan?.trial_days ?? 30) - BILLING_NOTICE_DAY);
    if (new Date(s.trial_ends_at).getTime() - now > leadDays * 86_400_000) continue;

    const { count } = await db.from("notification_jobs").select("id", { count: "exact", head: true })
      .eq("business_id", s.business_id).eq("kind", "trial_notice").eq("status", "sent");
    if (count) continue;

    const { data: owner } = await db.from("business_members").select("user_id").eq("business_id", s.business_id).eq("role", "owner").limit(1).maybeSingle();
    const user = owner ? (await db.auth.admin.getUserById(owner.user_id)).data.user : null;
    if (!user?.email || !s.business) { summary.skipped++; continue; }

    const { data: job } = await db.from("notification_jobs")
      .insert({ business_id: s.business_id, channel: "email", kind: "trial_notice", scheduled_for: new Date(now).toISOString() })
      .select("id").single();
    try {
      await sendEmail(user.email, renderTrialNotice({
        ownerName: (user.user_metadata?.full_name as string | undefined) ?? "", businessName: s.business.name,
        trialEndsAt: s.trial_ends_at, timeZone: s.business.timezone, priceLabel: brl(s.price_cents),
        cardOnFile: Boolean(s.provider_subscription_id), settingsUrl: `${SITE_URL}/painel/ajustes#assinatura`,
      }));
      if (job) await db.from("notification_jobs").update({ status: "sent", sent_at: new Date().toISOString(), attempts: 1 }).eq("id", job.id);
      summary.sent++;
    } catch (e) {
      if (job) await db.from("notification_jobs").update({ status: "failed", attempts: 1, last_error: String(e).slice(0, 500) }).eq("id", job.id);
      console.error("trial notice", s.business_id, String(e));
      summary.failed++;
    }
  }
  return { ...summary, configured: true };
}
