import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "./stripe";
import { invoiceSubscriptionId, mapStripeStatus, subscriptionPeriodEnd, toIso } from "./status";

/**
 * Lê o estado ATUAL da assinatura direto na Stripe (nunca confia só no payload do
 * webhook ou no redirecionamento do checkout) e grava no banco.
 */
export async function syncStripeSubscription(db: SupabaseClient, stripeSubscriptionId: string, cause: { event: string; eventId?: string; error?: string | null; amountCents?: number }) {
  const fetchedAt = new Date().toISOString();
  const sub = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
  const businessId = sub.metadata?.business_id;
  if (!businessId) throw new Error(`assinatura ${sub.id} sem business_id`);

  const { data: row } = await db.from("subscriptions")
    .select("id, status, trial_ends_at, provider_customer_id, provider_subscription_id")
    .eq("business_id", businessId).maybeSingle();
  if (!row) throw new Error(`negócio ${businessId} sem assinatura`);

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (row.provider_customer_id && row.provider_customer_id !== customerId) {
    throw new Error(`cliente Stripe diferente para o negócio ${businessId}`);
  }
  // Uma assinatura antiga cancelada não pode sobrescrever a atual
  if (row.provider_subscription_id && row.provider_subscription_id !== sub.id && sub.status === "canceled") {
    return { skipped: "assinatura antiga" };
  }

  const mapped = mapStripeStatus(sub.status);
  const item = sub.items.data[0];
  const update: Record<string, unknown> = {
    provider: "stripe",
    provider_customer_id: customerId,
    provider_subscription_id: sub.id,
    provider_status: sub.status,
    current_period_end: toIso(subscriptionPeriodEnd(sub)),
    cancel_at_period_end: sub.cancel_at_period_end,
    canceled_at: toIso(sub.canceled_at),
    provider_synced_at: fetchedAt,
  };
  if (mapped) update.status = mapped;
  if (sub.trial_end) update.trial_ends_at = toIso(sub.trial_end);
  if (item?.price?.unit_amount) update.price_cents = item.price.unit_amount;
  if (sub.metadata?.plan_id) update.plan = sub.metadata.plan_id;
  if (cause.error !== undefined) update.last_payment_error = cause.error?.slice(0, 300) ?? null;

  // Só grava se ninguém gravou um estado lido depois deste
  const { data: changed, error } = await db.from("subscriptions").update(update)
    .eq("id", row.id).lt("provider_synced_at", fetchedAt).select("id");
  if (error) throw new Error(`subscriptions: ${error.message}`);

  await db.from("subscription_events").insert({
    subscription_id: row.id, kind: cause.event,
    data: { stripe_event: cause.eventId ?? null, stripe_status: sub.status, status: mapped ?? row.status, applied: Boolean(changed?.length), ...(cause.amountCents !== undefined && { amount_cents: cause.amountCents }) },
  });
  return { status: mapped ?? row.status, applied: Boolean(changed?.length) };
}

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted",
  "customer.subscription.paused", "customer.subscription.resumed", "customer.subscription.trial_will_end",
]);

/** Decide o que fazer com cada evento. Eventos não tratados são só registrados. */
export async function handleStripeEvent(db: SupabaseClient, event: Stripe.Event) {
  const cause = { event: event.type, eventId: event.id };
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    if (s.mode !== "subscription" || !s.subscription) return { ignored: true };
    return syncStripeSubscription(db, typeof s.subscription === "string" ? s.subscription : s.subscription.id, cause);
  }
  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    return syncStripeSubscription(db, (event.data.object as Stripe.Subscription).id, cause);
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const subId = invoiceSubscriptionId(event.data.object);
    if (!subId) return { ignored: true };
    const error = event.type === "invoice.paid" ? null : "Pagamento recusado. Atualize o cartão para não pausar a agenda.";
    // Valor da fatura: o /admin conta como mês pago só fatura com valor (a de R$ 0 do teste não conta)
    return syncStripeSubscription(db, subId, { ...cause, error, amountCents: event.data.object.amount_paid ?? 0 });
  }
  return { ignored: true };
}

/**
 * Volta do checkout sem webhook ainda processado: consulta na Stripe as assinaturas
 * do cliente deste negócio e sincroniza. Não confia no redirecionamento em si.
 */
export async function reconcileBusinessSubscription(db: SupabaseClient, businessId: string) {
  const { data: row } = await db.from("subscriptions").select("provider_customer_id, provider_subscription_id").eq("business_id", businessId).maybeSingle();
  if (!row?.provider_customer_id || row.provider_subscription_id) return null;
  const list = await getStripe().subscriptions.list({ customer: row.provider_customer_id, status: "all", limit: 5 });
  const sub = list.data.filter((s) => s.metadata?.business_id === businessId).sort((a, b) => b.created - a.created)[0];
  if (!sub) return null;
  return syncStripeSubscription(db, sub.id, { event: "checkout.return.verified" });
}
