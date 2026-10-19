// Campanha "quem não volta": clientes que já vieram e estão sumidos há X dias, sem horário marcado.

export type CampaignCustomer = {
  id: string; name: string; phone: string; consent: boolean;
  appointments: { starts_at: string; status: string; price_cents: number }[];
};

export type Lapsed = { id: string; name: string; phone: string; consent: boolean; visits: number; spentCents: number; last: string; daysSince: number };

const DAY = 86_400_000;

export function lapsedCustomers(list: CampaignCustomer[], minDays: number, now = new Date()): Lapsed[] {
  const out: Lapsed[] = [];
  for (const c of list) {
    const future = c.appointments.some((a) => (a.status === "confirmed" || a.status === "pending") && new Date(a.starts_at) > now);
    const done = c.appointments.filter((a) => a.status === "completed" && new Date(a.starts_at) <= now);
    if (future || done.length === 0) continue;
    const last = done.reduce((m, a) => (a.starts_at > m ? a.starts_at : m), done[0].starts_at);
    const daysSince = Math.floor((now.getTime() - new Date(last).getTime()) / DAY);
    if (daysSince < minDays) continue;
    out.push({ id: c.id, name: c.name, phone: c.phone, consent: c.consent, visits: done.length, spentCents: done.reduce((s, a) => s + a.price_cents, 0), last, daysSince });
  }
  // Quem mais gastou primeiro: é quem mais vale trazer de volta
  return out.sort((a, b) => b.spentCents - a.spentCents || a.daysSince - b.daysSince);
}

/** Troca {nome}, {negocio}, {link} e {dias} na mensagem */
export function fillMessage(template: string, v: { name: string; business: string; link: string; days: number }) {
  const first = v.name.trim().split(/\s+/)[0] ?? "";
  return template.replaceAll("{nome}", first).replaceAll("{negocio}", v.business).replaceAll("{link}", v.link).replaceAll("{dias}", String(v.days));
}

export const DEFAULT_CAMPAIGN_MESSAGE = "Oi, {nome}! Tudo bem? Faz um tempinho que você não aparece aqui no {negocio} e sentimos sua falta. Que tal marcar seu horário? É rapidinho pelo link: {link}";
