import { onlyDigits, providerFetch, safeEqual, toCents } from "./http";
import { ProviderError, type ChargeState, type PaymentMethod, type PaymentStatus, type ProviderAccount, type ServicePaymentProvider } from "./types";

// Asaas: o estabelecimento conecta a própria conta com a chave de API dele.
// O dinheiro cai direto na conta Asaas do estabelecimento; a plataforma não intermedia.
const BASE = { sandbox: "https://api-sandbox.asaas.com/v3", production: "https://api.asaas.com/v3" } as const;
const BILLING: Record<PaymentMethod, string> = { pix: "PIX", card: "CREDIT_CARD", boleto: "BOLETO" };

type AsaasPayment = {
  id: string; status: string; value: number; externalReference: string | null; invoiceUrl: string | null;
  dueDate: string | null; confirmedDate?: string | null; paymentDate?: string | null; clientPaymentDate?: string | null; deleted?: boolean;
};

export function mapAsaasStatus(status: string, deleted = false): PaymentStatus {
  if (deleted) return "canceled";
  switch (status) {
    case "RECEIVED": case "CONFIRMED": case "RECEIVED_IN_CASH": case "DUNNING_RECEIVED":
    case "REFUND_REQUESTED": case "REFUND_IN_PROGRESS": return "paid";
    case "REFUNDED": return "refunded";
    case "OVERDUE": return "expired";
    case "CHARGEBACK_REQUESTED": case "CHARGEBACK_DISPUTE": case "AWAITING_CHARGEBACK_REVERSAL": return "failed";
    default: return "pending";
  }
}

function call<T>(acc: ProviderAccount, path: string, init: RequestInit = {}) {
  return providerFetch<T>("asaas", `${BASE[acc.environment]}${path}`, { ...init, headers: { access_token: acc.credentials.accessToken } });
}

function toState(p: AsaasPayment, extra: Partial<ChargeState> = {}): ChargeState {
  return {
    externalId: p.id, reference: p.externalReference ?? null, status: mapAsaasStatus(p.status, p.deleted),
    providerStatus: p.deleted ? "DELETED" : p.status, amountCents: toCents(p.value), checkoutUrl: p.invoiceUrl,
    paidAt: p.clientPaymentDate ?? p.paymentDate ?? p.confirmedDate ?? null, ...extra,
  };
}

export const asaas: ServicePaymentProvider = {
  id: "asaas",
  label: "Asaas",
  connection: "api_key",
  methods: ["pix", "card", "boleto"],

  async createCharge(acc, input) {
    const document = onlyDigits(input.customer.document);
    if (document.length !== 11 && document.length !== 14) throw new ProviderError("asaas", 422, "CPF ou CNPJ do cliente é obrigatório no Asaas");
    const found = await call<{ data: { id: string }[] }>(acc, `/customers?cpfCnpj=${document}&limit=1`);
    const customerId = found.data[0]?.id ?? (await call<{ id: string }>(acc, "/customers", {
      method: "POST",
      body: JSON.stringify({ name: input.customer.name, cpfCnpj: document, email: input.customer.email ?? undefined, mobilePhone: onlyDigits(input.customer.phone) || undefined }),
    })).id;

    const due = input.dueDate ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const p = await call<AsaasPayment>(acc, "/payments", {
      method: "POST",
      body: JSON.stringify({ customer: customerId, billingType: BILLING[input.method], value: input.amountCents / 100, dueDate: due, description: input.description.slice(0, 500), externalReference: input.reference }),
    });
    if (input.method !== "pix") return toState(p);
    const qr = await call<{ payload: string; expirationDate: string | null }>(acc, `/payments/${p.id}/pixQrCode`);
    return toState(p, { pixCopyPaste: qr.payload, expiresAt: qr.expirationDate });
  },

  async getCharge(acc, externalId) {
    return toState(await call<AsaasPayment>(acc, `/payments/${encodeURIComponent(externalId)}`));
  },

  // O Asaas manda no header o token que o estabelecimento cadastrou na configuração do webhook
  verifyWebhook(req, creds) {
    const token = req.headers.get("asaas-access-token") ?? "";
    if (!creds.webhookSecret || !safeEqual(token, creds.webhookSecret)) return null;
    let body: { id?: string; event?: string; payment?: { id?: string } };
    try { body = JSON.parse(req.rawBody); } catch { return null; }
    if (!body.event?.startsWith("PAYMENT_") || !body.payment?.id) return { ignore: true };
    return { eventId: body.id ?? `${body.event}:${body.payment.id}`, externalId: body.payment.id };
  },
};
