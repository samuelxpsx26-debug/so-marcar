import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptCredentials } from "./crypto";
import { getServiceProvider } from "./registry";
import type { CreateChargeInput, PaymentMethod, ProviderAccount, ProviderEnvironment, ServicePaymentProvider } from "./types";

export type LoadedAccount = { id: string; businessId: string; provider: ServicePaymentProvider; account: ProviderAccount };

/** Carrega a conta conectada do estabelecimento e descriptografa as credenciais (só em memória). */
export async function loadPaymentAccount(db: SupabaseClient, accountId: string, providerId: string): Promise<LoadedAccount | null> {
  const provider = getServiceProvider(providerId);
  if (!provider) return null;
  const { data } = await db.from("payment_accounts")
    .select("id, business_id, provider, environment, status, payment_account_secrets(ciphertext)")
    .eq("id", accountId).eq("provider", providerId).eq("status", "connected").maybeSingle();
  const secret = (data?.payment_account_secrets as unknown as { ciphertext: string } | null)?.ciphertext;
  if (!data || !secret) return null;
  return { id: data.id, businessId: data.business_id, provider, account: { environment: data.environment as ProviderEnvironment, credentials: decryptCredentials(secret) } };
}

/** Cria a cobrança de um serviço na conta do estabelecimento. */
export async function createServicePayment(db: SupabaseClient, acc: LoadedAccount, input: {
  method: PaymentMethod; amountCents: number; purpose: "deposit" | "full" | "other"; description: string;
  appointmentId?: string | null; customerId?: string | null; customer: CreateChargeInput["customer"];
  notificationUrl?: string; returnUrl?: string;
}) {
  if (!acc.provider.methods.includes(input.method)) throw new Error(`${acc.provider.label} não aceita ${input.method}`);
  const { data: row, error } = await db.from("payments").insert({
    business_id: acc.businessId, payment_account_id: acc.id, appointment_id: input.appointmentId ?? null, customer_id: input.customerId ?? null,
    provider: acc.provider.id, environment: acc.account.environment, purpose: input.purpose, method: input.method, amount_cents: input.amountCents,
  }).select("id").single();
  if (error || !row) throw new Error(`payments: ${error?.message}`);

  try {
    const c = await acc.provider.createCharge(acc.account, {
      reference: row.id, amountCents: input.amountCents, description: input.description, method: input.method,
      customer: input.customer, notificationUrl: input.notificationUrl, returnUrl: input.returnUrl,
    });
    await db.from("payments").update({
      external_id: c.externalId, status: c.status, provider_status: c.providerStatus, checkout_url: c.checkoutUrl ?? null,
      pix_copy_paste: c.pixCopyPaste ?? null, expires_at: c.expiresAt ?? null, provider_synced_at: new Date().toISOString(),
    }).eq("id", row.id);
    await db.from("payment_events").insert({ payment_id: row.id, kind: "created", data: { external_id: c.externalId, provider_status: c.providerStatus } });
    return { id: row.id, ...c };
  } catch (e) {
    await db.from("payments").update({ status: "failed", provider_status: "create_error" }).eq("id", row.id);
    await db.from("payment_events").insert({ payment_id: row.id, kind: "create_error", data: { error: String(e).slice(0, 300) } });
    throw e;
  }
}

/**
 * Consulta o estado final no provedor e aplica no pagamento certo.
 * O pagamento precisa ser da mesma conta e o valor precisa bater, senão nada muda.
 */
export async function reconcilePayment(db: SupabaseClient, acc: LoadedAccount, externalId: string, cause: string) {
  const fetchedAt = new Date().toISOString();
  const state = await acc.provider.getCharge(acc.account, externalId);
  const base = db.from("payments").select("id, status, amount_cents, external_id").eq("payment_account_id", acc.id).eq("business_id", acc.businessId);
  const { data: payment } = state.reference && /^[0-9a-f-]{36}$/i.test(state.reference)
    ? await base.eq("id", state.reference).maybeSingle()
    : await base.eq("external_id", state.externalId).maybeSingle();
  if (!payment) return { skipped: "pagamento não encontrado nesta conta" };

  if (state.amountCents !== null && state.amountCents !== payment.amount_cents) {
    await db.from("payment_events").insert({ payment_id: payment.id, kind: "amount_mismatch", data: { expected: payment.amount_cents, got: state.amountCents, cause } });
    return { skipped: "valor diferente" };
  }

  const update: Record<string, unknown> = { status: state.status, provider_status: state.providerStatus, external_id: state.externalId, provider_synced_at: fetchedAt };
  if (state.status === "paid") update.paid_at = state.paidAt ?? fetchedAt;
  if (state.status === "refunded") update.refunded_at = fetchedAt;
  const { data: changed, error } = await db.from("payments").update(update).eq("id", payment.id)
    .lt("provider_synced_at", fetchedAt).select("id");
  if (error) throw new Error(`payments: ${error.message}`);
  await db.from("payment_events").insert({ payment_id: payment.id, kind: cause, data: { from: payment.status, to: state.status, provider_status: state.providerStatus, applied: Boolean(changed?.length) } });
  return { status: state.status, applied: Boolean(changed?.length) };
}
