import { asaas } from "./asaas";
import { mercadopago } from "./mercadopago";
import type { ServicePaymentProvider, ServiceProviderId } from "./types";

export const SERVICE_PROVIDERS: Record<ServiceProviderId, ServicePaymentProvider> = { asaas, mercadopago };

/**
 * Provedores liberados para uso. Vazio por padrão: cada um só entra depois de testado,
 * com credenciais configuradas e validação comercial (env PAYMENT_PROVIDERS_ENABLED=asaas,mercadopago).
 */
export function enabledServiceProviders(raw = process.env.PAYMENT_PROVIDERS_ENABLED ?? ""): ServiceProviderId[] {
  return raw.split(",").map((s) => s.trim()).filter((s): s is ServiceProviderId => s in SERVICE_PROVIDERS);
}

export function getServiceProvider(id: string): ServicePaymentProvider | null {
  return enabledServiceProviders().includes(id as ServiceProviderId) ? SERVICE_PROVIDERS[id as ServiceProviderId] : null;
}
