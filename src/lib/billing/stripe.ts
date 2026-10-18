import "server-only";
import Stripe from "stripe";
import { stripeKeyMode } from "./status";

export function stripeMode() {
  return stripeKeyMode(process.env.STRIPE_SECRET_KEY, process.env.BILLING_LIVE_ENABLED === "true");
}

/** A cobrança só aparece quando a chave e o segredo do webhook estão configurados. */
export const billingConfigured = () => Boolean(stripeMode() && process.env.STRIPE_WEBHOOK_SECRET);

let client: Stripe | null = null;
export function getStripe(): Stripe {
  if (!stripeMode()) throw new Error("Stripe não configurada");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 });
  return client;
}
