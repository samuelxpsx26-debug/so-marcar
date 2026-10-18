// Regras puras da assinatura (sem rede), para testar sem a Stripe.
import type Stripe from "stripe";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";

/**
 * Status da Stripe -> status interno. `null` = não mexe no acesso
 * (ex.: checkout ainda aguardando confirmação do cartão).
 */
export function mapStripeStatus(status: string): SubscriptionStatus | null {
  switch (status) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due":
    case "unpaid": return "past_due";
    case "canceled": return "canceled";
    case "incomplete_expired":
    case "paused": return "expired";
    default: return null;
  }
}

/** Só chaves de teste funcionam, a não ser que a cobrança real seja liberada de propósito. */
export function stripeKeyMode(key: string | undefined, liveEnabled: boolean): "test" | "live" | null {
  if (!key) return null;
  if (/^(sk|rk)_test_/.test(key)) return "test";
  if (/^(sk|rk)_live_/.test(key) && liveEnabled) return "live";
  return null;
}

/** Fim do período atual (na API nova ele fica nos itens da assinatura). */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): number | null {
  const ends = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === "number");
  return ends.length ? Math.min(...ends) : null;
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const s = invoice.parent?.subscription_details?.subscription;
  if (!s) return null;
  return typeof s === "string" ? s : s.id;
}

export const toIso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);
