import { describe, expect, it } from "vitest";
import { buildOpportunities, dueCustomers, type CustomerVisit } from "../opportunities";
import { computeValue } from "../value";
import { pricePerDay, zonedToUtc, localDate, addDays, normalizePhone } from "../format";
import { isValidSlug, slugify } from "../slug";
import { contrast, resolveTheme } from "../theme";

const now = new Date("2026-10-20T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const customers: CustomerVisit[] = [
  { id: "1", name: "João Silva", phone: "5511999990001", visits: [daysAgo(80), daysAgo(50), daysAgo(20)], avgTicketCents: 4000, hasFutureBooking: false },
  { id: "2", name: "Maria", phone: "5511999990002", visits: [daysAgo(70), daysAgo(40)], avgTicketCents: 6000, hasFutureBooking: false },
  { id: "3", name: "Pedro", phone: "5511999990003", visits: [daysAgo(60), daysAgo(45)], avgTicketCents: 5000, hasFutureBooking: true },
  { id: "4", name: "Ana", phone: "5511999990004", visits: [daysAgo(400)], avgTicketCents: 5000, hasFutureBooking: false },
];

describe("dueCustomers", () => {
  it("acha quem passou do próprio ritmo e ignora quem já tem horário ou sumiu há muito", () => {
    const due = dueCustomers(customers, now);
    expect(due.map((c) => c.id)).toEqual(["2"]); // João volta a cada 30 dias e foi há 20
  });
});

describe("buildOpportunities", () => {
  it("prioriza horários livres e oferece para clientes no tempo de voltar", () => {
    const ops = buildOpportunities({
      now, businessName: "Barbearia da Ana", bookingUrl: "https://somarcar.app/ana",
      freeSlotsToday: [daysAgo(0), daysAgo(0)], avgTicketCents: 4000, customers,
      tomorrow: [{ id: "a", customerName: "Lia Souza", customerPhone: "5511", startsAt: daysAgo(-1), status: "confirmed", priceCents: 5000 }],
      unresolvedPast: [], trialDaysLeft: 20,
    });
    expect(ops[0].kind).toBe("fill_slots");
    expect(ops[0].contacts?.[0].message).toContain("Oi, Maria!");
    expect(ops.find((o) => o.kind === "confirm_tomorrow")?.valueCents).toBe(5000);
    expect(ops.some((o) => o.kind === "trial")).toBe(false);
  });
  it("teste acabando vira prioridade máxima", () => {
    const ops = buildOpportunities({ now, businessName: "X", bookingUrl: "u", freeSlotsToday: [], avgTicketCents: 0, customers: [], tomorrow: [], unresolvedPast: [], trialDaysLeft: 1 });
    expect(ops[0].kind).toBe("trial");
  });
});

describe("computeValue", () => {
  it("soma receita do link e atendimentos salvos por remarcação", () => {
    const v = computeValue([
      { status: "completed", source: "public", priceCents: 4000, rescheduled: false, startsAt: daysAgo(3) },
      { status: "completed", source: "admin", priceCents: 5000, rescheduled: true, startsAt: daysAgo(2) },
      { status: "no_show", source: "public", priceCents: 4000, rescheduled: false, startsAt: daysAgo(1) },
      { status: "cancelled", source: "public", priceCents: 9000, rescheduled: false, startsAt: daysAgo(1) },
    ], now);
    expect(v.onlineRevenue).toBe(4000);
    expect(v.savedRevenue).toBe(5000);
    expect(v.noShowRate).toBeCloseTo(1 / 3);
    expect(v.roiMultiple).toBeCloseTo(9000 / 3790);
  });
});

describe("format", () => {
  it("preço por dia para o marketing", () => expect(pricePerDay()).toBe("R$ 1,27"));
  it("converte horário local de São Paulo para UTC", () => {
    expect(zonedToUtc("2026-10-20", "09:00", "America/Sao_Paulo").toISOString()).toBe("2026-10-20T12:00:00.000Z");
    expect(localDate(new Date("2026-10-21T02:00:00Z"), "America/Sao_Paulo")).toBe("2026-10-20");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("normaliza telefone", () => expect(normalizePhone("(11) 98888-7777")).toBe("5511988887777"));
});

describe("slug e tema", () => {
  it("gera endereço limpo", () => {
    expect(slugify("Estética da Maria Ção!")).toBe("estetica-da-maria-cao");
    expect(isValidSlug("painel")).toBe(false);
    expect(isValidSlug("barbearia-ana")).toBe(true);
  });
  it("tema inválido cai no padrão e texto fica sempre legível", () => {
    const t = resolveTheme({ primary: "red", background: "#000000", image: "javascript:alert(1)" }, "barbearia");
    expect(t.primary).toBe("#d4a24c");
    expect(t.text).toBe("#ffffff");
    expect(t.image).toBeNull();
    expect(contrast(t.background, t.text)).toBeGreaterThan(4.5);
  });
});

import { renderEmail } from "../email-templates";

describe("renderEmail", () => {
  const d = {
    customerName: "João <b>Silva</b>", businessName: "Barbearia & Cia", serviceName: "Corte", professionalName: "Léo",
    startsAt: "2026-10-21T17:30:00Z", timeZone: "America/Sao_Paulo", manageUrl: "https://so-marcar.vercel.app/reserva/abc", primary: "#123456",
  };
  it("monta assunto, horário local e link", () => {
    const m = renderEmail("confirmation", d);
    expect(m.subject).toBe("Horário confirmado em Barbearia & Cia");
    expect(m.text).toContain("Quarta-feira, 21 de outubro às 14:30");
    expect(m.html).toContain("https://so-marcar.vercel.app/reserva/abc");
    expect(m.html).toContain("#123456");
  });
  it("escapa HTML vindo do cliente", () => {
    const m = renderEmail("reminder", d);
    expect(m.html).not.toContain("<b>");
    expect(m.html).toContain("Barbearia &amp; Cia");
  });
  it("ignora cor inválida", () => {
    expect(renderEmail("reschedule", { ...d, primary: "red;x" }).html).toContain("#7c3aed");
  });
});
