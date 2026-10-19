// "Oportunidades de Hoje": transforma os dados do negócio em ações concretas,
// em vez de obrigar o dono a interpretar gráficos. Função pura para ser testável.

export type CustomerVisit = {
  id: string;
  name: string;
  phone: string;
  visits: string[]; // ISO dos atendimentos concluídos, qualquer ordem
  avgTicketCents: number;
  hasFutureBooking: boolean;
};

export type DayAppointment = { id: string; customerName: string; customerPhone: string; startsAt: string; status: string; priceCents: number };

export type OpportunityInput = {
  now: Date;
  businessName: string;
  bookingUrl: string;
  freeSlotsToday: string[]; // ISO
  avgTicketCents: number;
  customers: CustomerVisit[];
  tomorrow: DayAppointment[];
  unresolvedPast: DayAppointment[]; // já passaram e ainda estão como "confirmado"
  trialDaysLeft: number | null;
  /** Pedidos da lista de espera cujo dia já tem horário livre no período pedido */
  waitlistOpenings?: WaitlistOpening[];
  /** Assinantes do clube com mensalidade vencendo, vencida ou nunca paga */
  clubDues?: ClubDue[];
};

export type ClubDue = { name: string; phone: string; planName: string; priceCents: number; daysLate: number }; // daysLate < 0: ainda vai vencer

export type WaitlistOpening = { entryId: string; name: string; phone: string; serviceName: string; dateLabel: string; times: string[]; priceCents: number };

export type Opportunity = {
  id: string;
  kind: "waitlist" | "club_due" | "fill_slots" | "win_back" | "confirm_tomorrow" | "close_out" | "trial";
  title: string;
  detail: string;
  valueCents: number;
  priority: number; // maior = mais importante
  contacts?: { name: string; phone: string; message: string; waitlistId?: string }[];
  href?: string;
};

const DAY = 86_400_000;

/** Clientes que passaram do ritmo normal de retorno */
export function dueCustomers(customers: CustomerVisit[], now: Date) {
  return customers
    .filter((c) => !c.hasFutureBooking && c.visits.length > 0)
    .map((c) => {
      const times = c.visits.map((v) => new Date(v).getTime()).sort((a, b) => a - b);
      const last = times[times.length - 1];
      const gaps = times.slice(1).map((t, i) => t - times[i]);
      const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 30 * DAY;
      const daysSince = Math.floor((now.getTime() - last) / DAY);
      const threshold = Math.max(14 * DAY, Math.min(avgGap * 1.3, 90 * DAY));
      return { ...c, daysSince, overdue: now.getTime() - last > threshold };
    })
    .filter((c) => c.overdue && c.daysSince <= 180)
    .sort((a, b) => b.avgTicketCents - a.avgTicketCents || a.daysSince - b.daysSince);
}

export function buildOpportunities(i: OpportunityInput): Opportunity[] {
  const out: Opportunity[] = [];
  const due = dueCustomers(i.customers, i.now);
  const first = (n: string) => n.trim().split(/\s+/)[0];

  const openings = i.waitlistOpenings ?? [];
  if (openings.length > 0) {
    out.push({
      id: "waitlist",
      kind: "waitlist",
      title: `Abriu vaga para ${openings.length} ${openings.length === 1 ? "pessoa" : "pessoas"} da lista de espera`,
      detail: "Elas pediram para ser avisadas. Quem chega primeiro no link fica com o horário.",
      valueCents: openings.reduce((s, o) => s + o.priceCents, 0),
      priority: 100,
      contacts: openings.map((o) => ({
        name: `${o.name} · ${o.dateLabel}`,
        phone: o.phone,
        waitlistId: o.entryId,
        message: `Oi, ${first(o.name)}! Abriu horário para ${o.serviceName} ${o.dateLabel} no ${i.businessName}: ${o.times.slice(0, 4).join(", ")}. Para garantir, marque aqui: ${i.bookingUrl}`,
      })),
      href: "/painel/espera",
    });
  }

  const dues = i.clubDues ?? [];
  if (dues.length > 0) {
    out.push({
      id: "club_due",
      kind: "club_due",
      title: `${dues.length} ${dues.length === 1 ? "mensalidade do clube para receber" : "mensalidades do clube para receber"}`,
      detail: "Lembre o cliente e, quando ele pagar, toque em \"Mensalidade recebida\" na ficha dele em Clientes.",
      valueCents: dues.reduce((s, d) => s + d.priceCents, 0),
      priority: 95,
      contacts: dues.map((d) => ({
        name: `${d.name} · ${d.daysLate > 0 ? `${d.daysLate} ${d.daysLate === 1 ? "dia" : "dias"} de atraso` : d.daysLate < 0 ? `vence em ${-d.daysLate} ${d.daysLate === -1 ? "dia" : "dias"}` : "vence hoje"}`,
        phone: d.phone,
        message: `Oi, ${first(d.name)}! Passando para lembrar da mensalidade do ${d.planName} aqui no ${i.businessName} (R$ ${(d.priceCents / 100).toFixed(2).replace(".", ",")}). Pode ser no Pix. Obrigado!`,
      })),
      href: "/painel/clientes",
    });
  }

  if (i.freeSlotsToday.length > 0) {
    const fill = Math.min(i.freeSlotsToday.length, Math.max(due.length, 1));
    out.push({
      id: "fill_slots",
      kind: "fill_slots",
      title: `${i.freeSlotsToday.length} ${i.freeSlotsToday.length === 1 ? "horário livre" : "horários livres"} hoje`,
      detail: due.length
        ? `Ofereça para ${Math.min(due.length, 5)} clientes que já estão no tempo de voltar.`
        : "Compartilhe seu link nos stories ou no status do WhatsApp.",
      valueCents: fill * i.avgTicketCents,
      priority: 90,
      contacts: due.slice(0, 5).map((c) => ({
        name: c.name,
        phone: c.phone,
        message: `Oi, ${first(c.name)}! Abriu um horário hoje aqui no ${i.businessName}. Quer garantir? Agende por aqui: ${i.bookingUrl}`,
      })),
      href: i.bookingUrl,
    });
  }

  if (due.length > 0) {
    out.push({
      id: "win_back",
      kind: "win_back",
      title: `${due.length} ${due.length === 1 ? "cliente está" : "clientes estão"} sumindo`,
      detail: "Passaram do tempo em que costumam voltar. Uma mensagem agora traz de volta.",
      valueCents: due.reduce((s, c) => s + c.avgTicketCents, 0),
      priority: 80,
      contacts: due.slice(0, 10).map((c) => ({
        name: c.name,
        phone: c.phone,
        message: `Oi, ${first(c.name)}! Faz ${c.daysSince} dias desde sua última visita no ${i.businessName}. Que tal agendar? ${i.bookingUrl}`,
      })),
    });
  }

  if (i.tomorrow.length > 0) {
    out.push({
      id: "confirm_tomorrow",
      kind: "confirm_tomorrow",
      title: `Confirme ${i.tomorrow.length} ${i.tomorrow.length === 1 ? "atendimento" : "atendimentos"} de amanhã`,
      detail: "Uma confirmação reduz faltas e libera o horário a tempo se alguém não puder vir.",
      valueCents: i.tomorrow.reduce((s, a) => s + a.priceCents, 0),
      priority: 70,
      contacts: i.tomorrow.map((a) => ({
        name: a.customerName,
        phone: a.customerPhone,
        message: `Oi, ${first(a.customerName)}! Passando para confirmar seu horário amanhã no ${i.businessName}. Se precisar remarcar, é só responder.`,
      })),
    });
  }

  if (i.unresolvedPast.length > 0) {
    out.push({
      id: "close_out",
      kind: "close_out",
      title: `Marque quem veio (${i.unresolvedPast.length})`,
      detail: "Registrar atendidos e faltas mantém seus números e lembretes de retorno certos.",
      valueCents: 0,
      priority: 60,
      href: "/painel/agenda",
    });
  }

  if (i.trialDaysLeft !== null && i.trialDaysLeft <= 7) {
    out.push({
      id: "trial",
      kind: "trial",
      title: i.trialDaysLeft <= 0 ? "Seu teste grátis terminou" : `Faltam ${i.trialDaysLeft} dias do teste grátis`,
      detail: "Ative a assinatura para sua agenda continuar recebendo reservas.",
      valueCents: 0,
      priority: i.trialDaysLeft <= 2 ? 95 : 50,
      href: "/painel/ajustes#assinatura",
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
