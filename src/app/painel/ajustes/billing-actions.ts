"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/business";
import { getPlan } from "@/lib/billing/plans";
import { billingConfigured, getStripe } from "@/lib/billing/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : SITE_URL;
}

const LIVE = ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"];

/** Abre o checkout hospedado da Stripe. O acesso só muda quando o webhook confirmar. */
export async function startCheckout() {
  const { business, role, email } = await getContext();
  if (role !== "owner") redirect("/painel/ajustes?assinatura=sem-permissao#assinatura");
  if (!billingConfigured()) redirect("/painel/ajustes?assinatura=indisponivel#assinatura");

  const db = createServiceClient();
  const stripe = getStripe();
  const { data: sub } = await db.from("subscriptions").select("id, plan, trial_ends_at, provider_customer_id, provider_subscription_id, provider_status").eq("business_id", business.id).single();
  if (!sub) redirect("/painel/ajustes?assinatura=erro#assinatura");

  // Já tem assinatura viva na Stripe: gerencia pelo portal em vez de criar outra
  if (sub.provider_subscription_id && LIVE.includes(sub.provider_status ?? "")) return openBillingPortal();

  const plan = await getPlan(db, sub.plan) ?? await getPlan(db);
  if (!plan) redirect("/painel/ajustes?assinatura=erro#assinatura");

  let customerId = sub.provider_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create(
      { email, name: business.name, metadata: { business_id: business.id } },
      { idempotencyKey: `customer-${business.id}` },
    );
    customerId = customer.id;
    await db.from("subscriptions").update({ provider: "stripe", provider_customer_id: customerId }).eq("id", sub.id);
  }

  // Quem assina durante o teste grátis não perde os dias que faltam
  const trialEnd = sub.trial_ends_at ? Math.floor(new Date(sub.trial_ends_at).getTime() / 1000) : 0;
  const keepTrial = trialEnd > Date.now() / 1000 + 48 * 3600;
  const base = await origin();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: business.id,
    locale: "pt-BR",
    line_items: [plan.stripe_price_id
      ? { price: plan.stripe_price_id, quantity: 1 }
      : { quantity: 1, price_data: { currency: plan.currency.toLowerCase(), unit_amount: plan.price_cents, recurring: { interval: plan.billing_interval }, product_data: { name: `Só Marcar ${plan.name}` } } }],
    subscription_data: { metadata: { business_id: business.id, plan_id: plan.id }, ...(keepTrial ? { trial_end: trialEnd } : {}) },
    metadata: { business_id: business.id },
    success_url: `${base}/painel/ajustes?assinatura=retorno#assinatura`,
    cancel_url: `${base}/painel/ajustes#assinatura`,
  });
  if (!session.url) redirect("/painel/ajustes?assinatura=erro#assinatura");
  redirect(session.url);
}

/** Portal da Stripe: trocar cartão, ver faturas, cancelar. */
export async function openBillingPortal() {
  const { business, role } = await getContext();
  if (role !== "owner") redirect("/painel/ajustes?assinatura=sem-permissao#assinatura");
  if (!billingConfigured()) redirect("/painel/ajustes?assinatura=indisponivel#assinatura");
  const { data: sub } = await createServiceClient().from("subscriptions").select("provider_customer_id").eq("business_id", business.id).single();
  if (!sub?.provider_customer_id) redirect("/painel/ajustes?assinatura=erro#assinatura");
  const portal = await getStripe().billingPortal.sessions.create({ customer: sub.provider_customer_id, return_url: `${await origin()}/painel/ajustes#assinatura` });
  redirect(portal.url);
}
