// Cartão fidelidade: cada atendimento realizado vale um selo.

/** Situação do cartão: selos no cartão atual e quantos prêmios estão liberados */
export function loyaltyCard(stamps: number, visits: number) {
  const rewards = Math.floor(stamps / visits);
  return { rewards, filled: rewards > 0 ? visits : stamps, missing: rewards > 0 ? 0 : visits - stamps };
}

export type CustomerPackage = {
  id: string; customer_id: string; service_id: string; name: string; sessions_total: number; sessions_used: number;
  price_cents: number; expires_at: string | null; created_at: string;
};

/** Pacote vendido junto com o cliente dono dele */
export type OpenPackage = CustomerPackage & { customer: { name: string; phone: string } | null };

/** Pacote ainda utilizável numa data (tem sessão e não venceu) */
export function packageUsable(p: CustomerPackage, at = new Date()) {
  return p.sessions_used < p.sessions_total && (!p.expires_at || new Date(p.expires_at) >= at);
}
