import { describe, expect, it } from "vitest";
import { buildOpportunities, dueCustomers, type CustomerVisit } from "../opportunities";
import { computeValue } from "../value";
import { pricePerDay, zonedToUtc, localDate, addDays, normalizePhone } from "../format";
import { isValidSlug, slugify } from "../slug";
import { contrast, resolveTheme } from "../theme";
import { mediaPathFromUrl, sniffImage } from "../media";
import { BACKDROPS, backgroundCatalog } from "../backgrounds";
import { PATTERNS } from "../patterns";
import { inPeriod, openTimes, waitlistOpenings } from "../waitlist";
import { crc16, depositCents, normalizePixKey, pixPayload } from "../pix";
import { computeReport, monthlyRevenue, rangeFor, type ReportAppt } from "../reports";

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

import { renderTrialNotice } from "../email-templates";

describe("renderTrialNotice", () => {
  const base = { ownerName: "Widney Silva", businessName: "Barbearia <X>", trialEndsAt: "2026-11-17T15:00:00Z", timeZone: "America/Sao_Paulo", priceLabel: "R$ 37,90", settingsUrl: "https://so-marcar.vercel.app/painel/ajustes#assinatura" };
  it("com cartão: avisa data e valor da primeira cobrança", () => {
    const m = renderTrialNotice({ ...base, cardOnFile: true });
    expect(m.subject).toBe("Seu teste grátis do Só Marcar termina em 17 de novembro");
    expect(m.text).toContain("primeira cobrança de R$ 37,90/mês");
    expect(m.html).toContain("Barbearia &lt;X&gt;");
  });
  it("sem cartão: deixa claro que nada é cobrado", () => {
    const m = renderTrialNotice({ ...base, cardOnFile: false });
    expect(m.text).toContain("nada será cobrado");
    expect(m.text).toContain("Cadastrar cartão");
  });
});

describe("resolveTheme estilos", () => {
  it("usa o estilo do nicho quando o tema não tem estilo salvo", () => {
    expect(resolveTheme({ primary: "#d9a84e", background: "#15110d" }, "barbearia").style).toBe("couro");
    expect(resolveTheme(null, "manicure").style).toBe("champagne");
    expect(resolveTheme(null, "clinica").style).toBe("moderno");
  });
  it("respeita o estilo salvo e ignora estilo inválido", () => {
    expect(resolveTheme({ style: "neon" }, "salao").style).toBe("neon");
    expect(resolveTheme({ style: "xpto" as never }, "personal").style).toBe("energia");
  });
  it("foto de capa vai para a capa, não para o fundo", () => {
    const t = resolveTheme({ image: "https://exemplo.com/a.jpg" }, "barbearia");
    expect(t.cover).toContain("https://exemplo.com/a.jpg");
    expect(t.backgroundImage).not.toContain("exemplo.com");
  });
});

describe("fotos", () => {
  it("reconhece JPEG, PNG e WebP pelo conteúdo e recusa o resto", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
  it("só reconhece como nossa a foto do bucket do próprio projeto", () => {
    const base = "https://abc.supabase.co";
    expect(mediaPathFromUrl(`${base}/storage/v1/object/public/midia/biz-1/capa-x.jpg`, base)).toBe("biz-1/capa-x.jpg");
    expect(mediaPathFromUrl("https://outro.site/foto.jpg", base)).toBeNull();
    expect(mediaPathFromUrl(null, base)).toBeNull();
  });
});

describe("foto de fundo", () => {
  it("sem escolha salva usa a 1ª foto do pacote do estilo e deixa o texto claro", () => {
    const t = resolveTheme({ style: "champagne", primary: "#9a4558", background: "#f6efe8" }, "salao");
    expect(t.photo).toContain(BACKDROPS.champagne[0].photo);
    expect(t.text).toBe("#ffffff");
    expect(String(t.backdrop?.backgroundImage)).toContain(t.photo!);
  });
  it("null desliga a foto e volta às cores do dono", () => {
    const t = resolveTheme({ style: "champagne", primary: "#9a4558", background: "#f6efe8", bg: null }, "salao");
    expect(t.photo).toBeNull();
    expect(t.backdrop).toBeNull();
    expect(t.text).toBe("#111111");
  });
  it("aceita id do pacote ou foto enviada, e ignora link inseguro", () => {
    expect(resolveTheme({ bg: "neon-2" }, "barbearia").photo).toContain(BACKDROPS.neon[1].photo);
    expect(resolveTheme({ bg: "https://x.supabase.co/a.jpg" }).photo).toBe("https://x.supabase.co/a.jpg");
    expect(resolveTheme({ bg: "javascript:alert(1)" }).photo).toBeNull();
  });
  it("todo estilo tem pacote e os ids não se repetem", () => {
    const ids = Object.values(BACKDROPS).flat().map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const list of Object.values(BACKDROPS)) expect(list.length).toBeGreaterThanOrEqual(3);
  });
  it("estampa e foto limpa deixam o texto escuro ou claro conforme o tom", () => {
    const claro = resolveTheme({ bg: "e-unhas-rosa" }, "manicure");
    expect(claro.text).toBe("#111111");
    expect(claro.ground).toBe("#fbf8f3");
    expect(String(claro.backdrop?.backgroundImage)).toContain("data:image/svg+xml");
    expect(resolveTheme({ bg: "e-barbearia-lousa" }, "barbearia").text).toBe("#ffffff");
    expect(resolveTheme({ bg: "limpa-unhas-1" }, "manicure").text).toBe("#111111");
  });
  it("o seletor mostra primeiro o nicho do cliente", () => {
    const c = backgroundCatalog("manicure", "champagne");
    expect(c.mine.slice(0, 3).map((i) => i.id)).toEqual(PATTERNS.filter((p) => p.niche === "unhas").map((p) => p.id));
    expect(c.more.flatMap((g) => g.items).some((i) => c.mine.some((m) => m.id === i.id))).toBe(false);
  });
});

describe("lista de espera", () => {
  const base = { now, businessName: "Barbearia Zé", bookingUrl: "https://so-marcar.vercel.app/ze", freeSlotsToday: [], avgTicketCents: 4000, customers: [], tomorrow: [], unresolvedPast: [], trialDaysLeft: null };

  it("filtra horários pelo período pedido", () => {
    const slots = ["2026-10-22T12:00:00Z", "2026-10-22T16:00:00Z", "2026-10-22T21:30:00Z", "2026-10-22T12:00:00Z"].map((starts_at) => ({ starts_at }));
    expect(openTimes(slots, "manha", "America/Sao_Paulo")).toEqual(["09:00"]);
    expect(openTimes(slots, "tarde", "America/Sao_Paulo")).toEqual(["13:00"]);
    expect(openTimes(slots, "noite", "America/Sao_Paulo")).toEqual(["18:30"]);
    expect(openTimes(slots, "qualquer", "America/Sao_Paulo")).toEqual(["09:00", "13:00", "18:30"]);
    expect(inPeriod("11:59", "manha")).toBe(true);
    expect(inPeriod("12:00", "manha")).toBe(false);
  });

  it("só avisa quem ainda espera e tem vaga", () => {
    const entry = (id: string, status: "waiting" | "notified") => ({ id, desired_date: "2026-10-24", period: "qualquer" as const, status, note: null, created_at: "", notified_at: null, service_id: "s", professional_id: null, customer: { name: "Ana Souza", phone: "5511999990009" }, service: { name: "Corte", price_cents: 4500 }, professional: null });
    const open = new Map([["a", ["10:00"]], ["b", ["10:00"]], ["c", []]]);
    const list = waitlistOpenings([entry("a", "waiting"), entry("b", "notified"), entry("c", "waiting")], open, "2026-10-20", "2026-10-21");
    expect(list.map((o) => o.entryId)).toEqual(["a"]);
    expect(list[0].dateLabel).toBe("no sábado, 24/10");
  });

  it("vira a primeira oportunidade do dia com a mensagem pronta", () => {
    const ops = buildOpportunities({ ...base, waitlistOpenings: [{ entryId: "a", name: "Ana Souza", phone: "5511999990009", serviceName: "Corte", dateLabel: "amanhã", times: ["10:00", "11:00"], priceCents: 4500 }] });
    expect(ops[0].kind).toBe("waitlist");
    expect(ops[0].valueCents).toBe(4500);
    expect(ops[0].contacts?.[0].waitlistId).toBe("a");
    expect(ops[0].contacts?.[0].message).toContain("Oi, Ana! Abriu horário para Corte amanhã no Barbearia Zé: 10:00, 11:00");
  });
});

describe("pix", () => {
  it("gera o BR Code oficial de exemplo do Banco Central", () => {
    const body = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(crc16(body)).toBe("1D3D");
    expect(pixPayload({ key: "123e4567-e12b-12d1-a456-426655440000", name: "Fulano de Tal", city: "BRASILIA" })).toBe(body + "1D3D");
  });

  it("inclui valor e identificador e tira acentos", () => {
    const p = pixPayload({ key: "+5511999990000", name: "Estúdio Ação & Cia", city: "São Paulo", amountCents: 1250, txid: "SM-ab12" });
    expect(p).toContain("540512.50");
    expect(p).toContain("5916Estudio Acao Cia");
    expect(p).toContain("6009Sao Paulo");
    expect(p).toContain("62100506SMab12");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });

  it("valida e normaliza chaves", () => {
    expect(normalizePixKey("cpf", "529.982.247-25")).toBe("52998224725");
    expect(normalizePixKey("cpf", "111.111.111-11")).toBeNull();
    expect(normalizePixKey("cnpj", "11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizePixKey("telefone", "(11) 99999-0000")).toBe("+5511999990000");
    expect(normalizePixKey("email", "Dono@Barbearia.com")).toBe("dono@barbearia.com");
    expect(normalizePixKey("aleatoria", "nao-e-chave")).toBeNull();
  });

  it("calcula o sinal", () => {
    expect(depositCents("percent", 30, 5000)).toBe(1500);
    expect(depositCents("fixed", 2000, 5000)).toBe(2000);
    expect(depositCents("fixed", 9000, 5000)).toBe(5000);
    expect(depositCents("off", 30, 5000)).toBe(0);
  });
});

describe("relatórios", () => {
  const tz = "America/Sao_Paulo";
  const ap = (startsAt: string, status: string, priceCents: number, customerId: string, extra: Partial<ReportAppt> = {}): ReportAppt => ({
    startsAt, status, source: "public", priceCents, customerId, customerName: `C${customerId}`, customerPhone: "55119", customerCreatedAt: "", serviceName: "Corte", professionalName: "Zé", ...extra,
  });
  const list = [
    ap("2026-09-10T15:00:00Z", "completed", 4000, "1"),
    ap("2026-10-02T15:00:00Z", "completed", 4000, "1"),
    ap("2026-10-03T15:00:00Z", "completed", 6000, "2", { serviceName: "Barba", source: "admin" }),
    ap("2026-10-05T15:00:00Z", "no_show", 4000, "3"),
    ap("2026-10-06T15:00:00Z", "cancelled", 4000, "3"),
    ap("2026-10-19T15:00:00Z", "confirmed", 4000, "4"),
    ap("2026-10-25T15:00:00Z", "confirmed", 5000, "5"),
  ];

  it("resume o mês", () => {
    const r = computeReport(list, rangeFor("mes", "2026-10-20"), tz, new Date("2026-10-20T12:00:00Z"));
    expect(r.revenue).toBe(10000);
    expect(r.completed).toBe(2);
    expect(r.avgTicket).toBe(5000);
    expect(r.noShowRate).toBeCloseTo(1 / 3);
    expect(r.newCustomers).toBe(1);
    expect(r.returningCustomers).toBe(1);
    expect(r.unmarked).toBe(1);
    expect(r.upcomingCents).toBe(5000);
    expect(r.services[0]).toMatchObject({ name: "Barba", cents: 6000 });
    expect(r.online).toBe(4);
  });

  it("monta os períodos e o faturamento por mês", () => {
    expect(rangeFor("mes-passado", "2026-01-15")).toMatchObject({ from: "2025-12-01", to: "2026-01-01" });
    expect(rangeFor("90d", "2026-10-20")).toMatchObject({ from: "2026-07-23", to: "2026-10-21" });
    const m = monthlyRevenue(list, tz, new Date("2026-10-20T12:00:00Z"), 3);
    expect(m.map((x) => [x.key, x.cents])).toEqual([["2026-08", 0], ["2026-09", 4000], ["2026-10", 10000]]);
  });
});
