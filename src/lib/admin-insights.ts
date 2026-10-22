// Painel do dono do Só Marcar: transforma a lista de negócios (platform_accounts) em
// números de uso, funil, alertas de quem precisa de contato e safras por mês de cadastro.

export type Account = {
  id: string; name: string; slug: string; segment: string; created_at: string;
  owner_name: string | null; owner_email: string | null; owner_phone: string | null;
  last_seen_at: string | null;
  status: string | null; trial_ends_at: string | null; current_period_end: string | null; cancel_at_period_end: boolean | null;
  price_cents: number | null; has_checkout: boolean;
  paid_months: number; services: number; professionals: number;
  appointments: number; online_appointments: number; appointments_7d: number; customers: number;
};

export type Stage = "trial" | "trial_over" | "paying" | "past_due" | "canceled";
export const STAGE_LABEL: Record<Stage, string> = {
  trial: "Em teste", trial_over: "Teste vencido", paying: "Pagante", past_due: "Em atraso", canceled: "Cancelado",
};

const DAY = 86_400_000;
const daysBetween = (a: number, b: number) => Math.floor((a - b) / DAY);

export function stageOf(a: Account, now: number): Stage {
  if (a.status === "active") return "paying";
  if (a.status === "past_due") return "past_due";
  if (a.status === "canceled" || a.status === "expired") return "canceled";
  return a.trial_ends_at && Date.parse(a.trial_ends_at) < now ? "trial_over" : "trial";
}

/** Último acesso ao painel; sem registro, usa a data do cadastro */
export const lastActivity = (a: Account) => Date.parse(a.last_seen_at ?? a.created_at);

export type Alert = { kind: "trial_ending" | "not_setup" | "inactive" | "past_due" | "cancelling" | "trial_over"; account: Account; text: string; message: string };

const first = (a: Account) => (a.owner_name ?? "").trim().split(/\s+/)[0] || "tudo bem";

/** Quem precisa de um contato seu agora, do mais urgente ao menos urgente */
export function alertsFor(list: Account[], now: number): Alert[] {
  const out: Alert[] = [];
  for (const a of list) {
    const stage = stageOf(a, now);
    const hi = `Oi, ${first(a)}! Aqui é o Widney, do Só Marcar.`;
    if (stage === "past_due") {
      out.push({ kind: "past_due", account: a, text: "Pagamento recusado", message: `${hi} Vi que o pagamento da mensalidade não passou. Quer ajuda para atualizar o cartão e não pausar a agenda?` });
    } else if (a.cancel_at_period_end && stage === "paying") {
      out.push({ kind: "cancelling", account: a, text: "Pediu para cancelar", message: `${hi} Vi que você pediu o cancelamento. Posso saber o que faltou? Quero melhorar o app.` });
    } else if (stage === "trial") {
      const left = a.trial_ends_at ? Math.ceil((Date.parse(a.trial_ends_at) - now) / DAY) : 99;
      if (left <= 3 && !a.has_checkout) {
        out.push({ kind: "trial_ending", account: a, text: left <= 0 ? "Teste acaba hoje" : `Teste acaba em ${left} ${left === 1 ? "dia" : "dias"}`, message: `${hi} Seu teste grátis está acabando. Como está sendo usar a agenda? Se quiser, te ajudo a ativar o plano.` });
      }
    } else if (stage === "trial_over") {
      out.push({ kind: "trial_over", account: a, text: "Teste acabou sem assinar", message: `${hi} Seu teste terminou. Ficou alguma dúvida ou faltou alguma coisa para continuar?` });
    }
    if (stage === "trial" || stage === "paying") {
      if (a.services === 0 && now - Date.parse(a.created_at) > DAY) {
        out.push({ kind: "not_setup", account: a, text: "Cadastrou e não configurou", message: `${hi} Vi que você criou sua conta. Quer ajuda para cadastrar seus serviços? Leva 5 minutos.` });
      } else {
        const idle = daysBetween(now, lastActivity(a));
        if (idle >= 7) out.push({ kind: "inactive", account: a, text: `Sem entrar há ${idle} dias`, message: `${hi} Faz uns dias que você não entra no painel. Está tudo certo com a agenda? Posso ajudar em algo?` });
      }
    }
  }
  const order: Alert["kind"][] = ["past_due", "trial_ending", "cancelling", "not_setup", "trial_over", "inactive"];
  return out.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind));
}

export function summarize(list: Account[], now: number) {
  const stages = list.map((a) => stageOf(a, now));
  const count = (s: Stage) => stages.filter((x) => x === s).length;
  const seenWithin = (ms: number) => list.filter((a) => a.last_seen_at && now - Date.parse(a.last_seen_at) <= ms).length;
  const paidOnce = list.filter((a) => a.paid_months >= 1).length;
  const paidTwice = list.filter((a) => a.paid_months >= 2).length;
  // Cada etapa conta só quem passou pelas anteriores, para o funil nunca "subir"
  const steps: [string, (a: Account) => boolean][] = [
    ["Criaram a conta", () => true],
    ["Cadastraram serviços", (a) => a.services > 0],
    ["Receberam agendamento", (a) => a.appointments > 0],
    ["Pagaram o 1º mês", (a) => a.paid_months >= 1],
    ["Pagaram o 2º mês", (a) => a.paid_months >= 2],
  ];
  const funnel = steps.map(([label], i) => ({ label, n: list.filter((a) => steps.slice(0, i + 1).every(([, ok]) => ok(a))).length }));
  return {
    total: list.length,
    newLast7: list.filter((a) => now - Date.parse(a.created_at) <= 7 * DAY).length,
    onlineNow: seenWithin(5 * 60_000),
    activeToday: seenWithin(DAY),
    active7: seenWithin(7 * DAY),
    trial: count("trial"), trialOver: count("trial_over"), paying: count("paying"), pastDue: count("past_due"), canceled: count("canceled"),
    mrrCents: list.filter((a, i) => stages[i] === "paying" || stages[i] === "past_due").reduce((s, a) => s + (a.price_cents ?? 0), 0),
    paidOnce, paidTwice,
    secondMonthRate: paidOnce ? paidTwice / paidOnce : null,
    funnel,
  };
}

/** Safras: de quem se cadastrou em cada mês, quantos configuraram e pagaram */
export function cohorts(list: Account[], timeZone = "America/Sao_Paulo") {
  const key = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);
  const map = new Map<string, { month: string; signups: number; setup: number; paid1: number; paid2: number }>();
  for (const a of list) {
    const m = key(a.created_at);
    const row = map.get(m) ?? { month: m, signups: 0, setup: 0, paid1: 0, paid2: 0 };
    row.signups += 1;
    if (a.services > 0) row.setup += 1;
    if (a.paid_months >= 1) row.paid1 += 1;
    if (a.paid_months >= 2) row.paid2 += 1;
    map.set(m, row);
  }
  return [...map.values()].sort((x, y) => (x.month < y.month ? 1 : -1));
}

/** Planilha CSV (separador ;) para abrir no Excel */
export function accountsCsv(list: Account[], now: number) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Negócio", "Link", "Ramo", "Dono", "E-mail", "WhatsApp", "Situação", "Meses pagos", "Cadastro", "Último acesso", "Serviços", "Agendamentos", "Pelo link"];
  const rows = list.map((a) => [a.name, `somarcar.app.br/${a.slug}`, a.segment, a.owner_name, a.owner_email, a.owner_phone, STAGE_LABEL[stageOf(a, now)], a.paid_months,
    a.created_at.slice(0, 10), a.last_seen_at?.slice(0, 16).replace("T", " ") ?? "", a.services, a.appointments, a.online_appointments]);
  return "﻿" + [head, ...rows].map((r) => r.map(esc).join(";")).join("\n");
}

/** Link do WhatsApp com DDI do Brasil */
export function waLink(phone: string | null, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`}?text=${encodeURIComponent(text)}`;
}
