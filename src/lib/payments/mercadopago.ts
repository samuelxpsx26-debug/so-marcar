import { createHmac } from "node:crypto";
import { onlyDigits, providerFetch, safeEqual } from "./http";
import { ProviderError, type ChargeState, type PaymentStatus, type ProviderAccount, type ServicePaymentProvider } from "./types";

// Mercado Pago: o estabelecimento autoriza a plataforma por OAuth e o token é da conta dele.
// O dinheiro cai na conta Mercado Pago do estabelecimento. Sem marketplace_fee (sem comissão).
const API = "https://api.mercadopago.com";

type MpPayment = {
  id: number; status: string; transaction_amount: number; external_reference: string | null; date_approved: string | null;
  date_of_expiration: string | null;
  point_of_interaction?: { transaction_data?: { qr_code?: string; ticket_url?: string } };
};

export function mapMercadoPagoStatus(status: string): PaymentStatus {
  switch (status) {
    case "approved": return "paid";
    case "refunded": case "charged_back": return "refunded";
    case "cancelled": return "canceled";
    case "rejected": return "failed";
    default: return "pending"; // pending, in_process, authorized, in_mediation
  }
}

function call<T>(acc: ProviderAccount, path: string, init: RequestInit = {}) {
  return providerFetch<T>("mercadopago", `${API}${path}`, { ...init, headers: { Authorization: `Bearer ${acc.credentials.accessToken}`, ...init.headers } });
}

function toState(p: MpPayment): ChargeState {
  return {
    externalId: String(p.id), reference: p.external_reference, status: mapMercadoPagoStatus(p.status), providerStatus: p.status,
    amountCents: Math.round(p.transaction_amount * 100), paidAt: p.date_approved, expiresAt: p.date_of_expiration,
    pixCopyPaste: p.point_of_interaction?.transaction_data?.qr_code ?? null, checkoutUrl: p.point_of_interaction?.transaction_data?.ticket_url ?? null,
  };
}

/**
 * Confere o header x-signature: HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * com o segredo do webhook. Rejeita avisos com mais de 10 minutos.
 */
export function verifyMercadoPagoSignature(headers: Headers, dataId: string, secret: string, nowMs = Date.now()): boolean {
  const sig = headers.get("x-signature") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  if (!parts.ts || !parts.v1 || !secret) return false;
  const tsMs = Number(parts.ts) * (parts.ts.length > 10 ? 1 : 1000);
  if (!Number.isFinite(tsMs) || Math.abs(nowMs - tsMs) > 10 * 60_000) return false;
  const requestId = headers.get("x-request-id");
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};${requestId ? `request-id:${requestId};` : ""}ts:${parts.ts};`;
  return safeEqual(createHmac("sha256", secret).update(manifest).digest("hex"), parts.v1);
}

export const mercadopago: ServicePaymentProvider = {
  id: "mercadopago",
  label: "Mercado Pago",
  connection: "oauth",
  methods: ["pix", "card"],

  async createCharge(acc, input) {
    if (input.method === "pix") {
      if (!input.customer.email) throw new ProviderError("mercadopago", 422, "E-mail do cliente é obrigatório para Pix no Mercado Pago");
      const document = onlyDigits(input.customer.document);
      const p = await call<MpPayment>(acc, "/v1/payments", {
        method: "POST",
        headers: { "X-Idempotency-Key": input.reference },
        body: JSON.stringify({
          transaction_amount: input.amountCents / 100, description: input.description.slice(0, 250), payment_method_id: "pix",
          external_reference: input.reference, notification_url: input.notificationUrl,
          payer: { email: input.customer.email, first_name: input.customer.name, ...(document ? { identification: { type: document.length === 14 ? "CNPJ" : "CPF", number: document } } : {}) },
        }),
      });
      return toState(p);
    }
    // Cartão: Checkout Pro (o cliente digita o cartão na página do Mercado Pago, nunca aqui)
    const pref = await call<{ id: string; init_point: string; sandbox_init_point: string }>(acc, "/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({
        items: [{ id: input.reference, title: input.description.slice(0, 250), quantity: 1, unit_price: input.amountCents / 100, currency_id: "BRL" }],
        external_reference: input.reference, notification_url: input.notificationUrl,
        payment_methods: { excluded_payment_types: [{ id: "ticket" }], installments: 1 },
        ...(input.returnUrl ? { back_urls: { success: input.returnUrl, failure: input.returnUrl, pending: input.returnUrl } } : {}),
      }),
    });
    // O id do pagamento só nasce quando o cliente paga; a conciliação usa external_reference
    return {
      externalId: `pref_${pref.id}`, reference: input.reference, status: "pending", providerStatus: "preference_created", amountCents: input.amountCents,
      checkoutUrl: acc.environment === "sandbox" ? pref.sandbox_init_point : pref.init_point,
    };
  },

  async getCharge(acc, externalId) {
    if (externalId.startsWith("pref_")) throw new ProviderError("mercadopago", 400, "preferência não é pagamento; aguarde o webhook do pagamento");
    return toState(await call<MpPayment>(acc, `/v1/payments/${encodeURIComponent(externalId)}`));
  },

  verifyWebhook(req, creds) {
    const dataId = req.url.searchParams.get("data.id");
    const type = req.url.searchParams.get("type");
    if (!dataId) return null;
    if (!verifyMercadoPagoSignature(req.headers, dataId, creds.webhookSecret)) return null;
    if (type && type !== "payment") return { ignore: true };
    return { eventId: `${req.headers.get("x-request-id") ?? "sem-id"}:${dataId}`, externalId: dataId };
  },
};

/** Link para o estabelecimento autorizar a conta dele (OAuth). Ainda não exposto na interface. */
export function mercadoPagoAuthorizeUrl(clientId: string, redirectUri: string, state: string) {
  const u = new URL("https://auth.mercadopago.com.br/authorization");
  u.search = new URLSearchParams({ client_id: clientId, response_type: "code", platform_id: "mp", state, redirect_uri: redirectUri }).toString();
  return u.toString();
}
