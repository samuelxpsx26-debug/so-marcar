// Pagamentos de serviços: o cliente final paga o estabelecimento, na conta do próprio estabelecimento.
// Nada aqui toca na assinatura do SaaS (ver src/lib/billing).

export type ServiceProviderId = "asaas" | "mercadopago";
export type ProviderEnvironment = "sandbox" | "production";
export type PaymentMethod = "pix" | "card" | "boleto";
export type PaymentStatus = "pending" | "paid" | "refunded" | "canceled" | "failed" | "expired";

/** Credenciais da conta do estabelecimento. Só existem descriptografadas no servidor, durante a chamada. */
export type ProviderCredentials = {
  accessToken: string;
  /** Asaas: token que o Asaas envia no header. Mercado Pago: segredo da assinatura do webhook. */
  webhookSecret: string;
};

export type ProviderAccount = { environment: ProviderEnvironment; credentials: ProviderCredentials };

export type CreateChargeInput = {
  /** Nosso id do pagamento (payments.id). Vai como referência externa para conciliação. */
  reference: string;
  amountCents: number;
  description: string;
  method: PaymentMethod;
  customer: { name: string; email?: string | null; phone?: string | null; document?: string | null };
  dueDate?: string; // YYYY-MM-DD
  notificationUrl?: string;
  returnUrl?: string;
};

export type ChargeState = {
  externalId: string;
  /** Referência que enviamos (payments.id), quando o provedor devolve */
  reference: string | null;
  status: PaymentStatus;
  providerStatus: string;
  amountCents: number | null;
  checkoutUrl?: string | null;
  pixCopyPaste?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
};

export type WebhookRequest = { headers: Headers; rawBody: string; url: URL };
/** Resultado da validação: só um id para consultar no provedor. Nunca confiamos no status do payload. */
export type WebhookNotice = { eventId: string; externalId: string } | { ignore: true } | null;

export interface ServicePaymentProvider {
  id: ServiceProviderId;
  label: string;
  /** Como o estabelecimento conecta a própria conta */
  connection: "api_key" | "oauth";
  methods: readonly PaymentMethod[];
  createCharge(account: ProviderAccount, input: CreateChargeInput): Promise<ChargeState>;
  /** Estado final consultado direto no provedor */
  getCharge(account: ProviderAccount, externalId: string): Promise<ChargeState>;
  /** Confere a autenticidade do webhook. `null` = inválido. */
  verifyWebhook(req: WebhookRequest, credentials: ProviderCredentials): WebhookNotice;
}

export class ProviderError extends Error {
  constructor(public provider: ServiceProviderId, public status: number, message: string) {
    super(`${provider} ${status}: ${message}`);
  }
}
