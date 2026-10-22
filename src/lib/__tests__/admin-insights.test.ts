import { describe, expect, it } from "vitest";
import { accountsCsv, alertsFor, cohorts, stageOf, summarize, waLink, type Account } from "../admin-insights";

const now = Date.parse("2026-10-22T15:00:00Z");
const acc = (o: Partial<Account>): Account => ({
  id: "x", name: "Barbearia", slug: "barbearia", segment: "barbearia", created_at: "2026-10-01T12:00:00Z",
  owner_name: "João Silva", owner_email: "j@x.com", owner_phone: "11999990000", last_seen_at: "2026-10-22T14:58:00Z",
  status: "trialing", trial_ends_at: "2026-10-31T12:00:00Z", current_period_end: null, cancel_at_period_end: false,
  price_cents: 3790, has_checkout: false, paid_months: 0, services: 3, professionals: 1,
  appointments: 5, online_appointments: 3, appointments_7d: 2, customers: 4, ...o,
});

describe("painel do dono", () => {
  it("classifica a situação de cada negócio", () => {
    expect(stageOf(acc({}), now)).toBe("trial");
    expect(stageOf(acc({ trial_ends_at: "2026-10-20T00:00:00Z" }), now)).toBe("trial_over");
    expect(stageOf(acc({ status: "active" }), now)).toBe("paying");
    expect(stageOf(acc({ status: "expired" }), now)).toBe("canceled");
  });

  it("resume uso, pagamentos e funil", () => {
    const s = summarize([
      acc({ id: "a", status: "active", paid_months: 2 }),
      acc({ id: "b", status: "active", paid_months: 1, last_seen_at: "2026-10-22T08:00:00Z" }),
      acc({ id: "c", services: 0, appointments: 0, last_seen_at: null, created_at: "2026-10-20T00:00:00Z" }),
    ], now);
    expect(s.onlineNow).toBe(1);
    expect(s.activeToday).toBe(2);
    expect(s.paying).toBe(2);
    expect(s.mrrCents).toBe(7580);
    expect(s.secondMonthRate).toBe(0.5);
    expect(s.funnel.map((f) => f.n)).toEqual([3, 2, 2, 2, 1]);
    expect(s.newLast7).toBe(1);
  });

  it("aponta quem precisa de contato, do mais urgente", () => {
    const alerts = alertsFor([
      acc({ id: "idle", last_seen_at: "2026-10-10T00:00:00Z" }),
      acc({ id: "ending", trial_ends_at: "2026-10-24T12:00:00Z" }),
      acc({ id: "card", trial_ends_at: "2026-10-24T12:00:00Z", has_checkout: true }),
      acc({ id: "late", status: "past_due" }),
      acc({ id: "empty", services: 0 }),
      acc({ id: "fine" }),
    ], now);
    expect(alerts.map((a) => a.account.id)).toEqual(["late", "ending", "empty", "idle"]);
    expect(alerts[1].text).toBe("Teste acaba em 2 dias");
    expect(alerts[0].message).toContain("Oi, João!");
  });

  it("monta safras, planilha e link do WhatsApp", () => {
    const c = cohorts([acc({ created_at: "2026-09-30T23:00:00-03:00", paid_months: 1 }), acc({})]);
    expect(c.map((r) => [r.month, r.signups, r.paid1])).toEqual([["2026-10", 1, 0], ["2026-09", 1, 1]]);
    expect(accountsCsv([acc({ name: 'Bar "do" Zé' })], now)).toContain('"Bar ""do"" Zé"');
    expect(waLink("(11) 99999-0000", "oi")).toBe("https://wa.me/5511999990000?text=oi");
    expect(waLink("5511999990000", "oi")).toBe("https://wa.me/5511999990000?text=oi");
    expect(waLink(null, "oi")).toBeNull();
  });
});
