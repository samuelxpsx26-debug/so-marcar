import { describe, expect, it } from "vitest";
import { computeFinance, fixedActiveIn, ruleFor, shiftMonth, type CommissionRule, type FinAppt } from "../finance";

const tz = "America/Sao_Paulo";
const appt = (o: Partial<FinAppt>): FinAppt => ({
  startsAt: "2026-10-10T15:00:00Z", status: "completed", priceCents: 5000, servicePriceCents: 5000, prepaid: false, professionalId: "ana", serviceId: "corte", ...o,
});
const rules: CommissionRule[] = [
  { professional_id: "ana", service_id: null, mode: "percent", value: 4000 },
  { professional_id: "ana", service_id: "barba", mode: "fixed", value: 1000 },
  { professional_id: "beto", service_id: null, mode: "fixed", value: 1500 },
];

describe("financeiro", () => {
  it("regra do serviço vence a geral", () => {
    expect(ruleFor(rules, "ana", "barba")?.mode).toBe("fixed");
    expect(ruleFor(rules, "ana", "corte")?.value).toBe(4000);
    expect(ruleFor(rules, "caio", "corte")).toBeNull();
  });

  it("gasto fixo vale entre o início e o fim", () => {
    const f = { starts_on: "2026-09-01", ends_on: "2026-11-01" };
    expect(fixedActiveIn(f, "2026-08")).toBe(false);
    expect(fixedActiveIn(f, "2026-10")).toBe(true);
    expect(fixedActiveIn(f, "2026-11")).toBe(true);
    expect(fixedActiveIn(f, "2026-12")).toBe(false);
    expect(fixedActiveIn({ starts_on: "2026-01-01", ends_on: null }, "2027-05")).toBe(true);
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("calcula comissões, gastos e lucro real do mês", () => {
    const r = computeFinance({
      month: "2026-10", timeZone: tz,
      pros: [{ id: "ana", name: "Ana" }, { id: "beto", name: "Beto" }],
      rules,
      appts: [
        appt({}), // Ana corte 50 -> 40% = 20
        appt({ serviceId: "barba", priceCents: 3000 }), // Ana barba fixo 10
        appt({ professionalId: "beto" }), // Beto fixo 15
        appt({ prepaid: true, priceCents: 0, servicePriceCents: 6000 }), // pacote: comissão sobre 60 -> 24, faturamento 0
        appt({ status: "no_show" }), // não conta
        appt({ startsAt: "2026-11-01T02:00:00Z" }), // 31/10 23h em SP: conta em outubro
        appt({ startsAt: "2026-11-01T04:00:00Z" }), // 1/11 em SP: fica fora
      ],
      expenses: [
        { id: "1", category: "Gasolina", description: null, amount_cents: 8000, spent_on: "2026-10-05" },
        { id: "2", category: "Anúncios", description: null, amount_cents: 5000, spent_on: "2026-09-30" },
      ],
      fixed: [
        { id: "f", category: "Aluguel", description: null, amount_cents: 20000, starts_on: "2026-01-01", ends_on: null },
        { id: "g", category: "Energia", description: null, amount_cents: 7000, starts_on: "2026-11-01", ends_on: null },
      ],
      payouts: [{ professional_id: "beto", month: "2026-10-01", amount_cents: 1500, paid_at: "2026-10-31T20:00:00Z" }],
      packageSales: [{ priceCents: 24000, createdAt: "2026-10-02T15:00:00Z" }],
    });
    expect(r.serviceRevenue).toBe(5000 + 3000 + 5000 + 0 + 5000);
    expect(r.revenue).toBe(18000 + 24000);
    expect(r.commissionTotal).toBe(2000 + 1000 + 1500 + 2400 + 2000);
    const ana = r.commissions.find((c) => c.professionalId === "ana")!;
    expect(ana.count).toBe(4);
    expect(ana.paidCents).toBeNull();
    expect(r.commissions.find((c) => c.professionalId === "beto")!.paidCents).toBe(1500);
    expect(r.fixedTotal).toBe(20000);
    expect(r.variableTotal).toBe(8000);
    expect(r.profit).toBe(42000 - 8900 - 28000);
    expect(r.byCategory[0]).toEqual({ name: "Aluguel", cents: 20000 });
  });

  it("mostra quanto falta faturar para cobrir as contas", () => {
    const r = computeFinance({
      month: "2026-10", timeZone: tz, pros: [{ id: "ana", name: "Ana" }],
      rules: [{ professional_id: "ana", service_id: null, mode: "percent", value: 5000 }],
      appts: [appt({ priceCents: 10000, servicePriceCents: 10000 })],
      expenses: [], payouts: [],
      fixed: [{ id: "f", category: "Aluguel", description: null, amount_cents: 30000, starts_on: "2026-10-01", ends_on: null }],
    });
    // fica 50% de cada real: precisa faturar 600 para cobrir 300; já faturou 100
    expect(r.breakEvenRevenue).toBe(60000);
    expect(r.missingToBreakEven).toBe(50000);
    expect(r.profit).toBe(10000 - 5000 - 30000);
  });
});
