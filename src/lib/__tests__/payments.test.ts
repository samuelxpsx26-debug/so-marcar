import { createHmac, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mapStripeStatus, stripeKeyMode } from "../billing/status";
import { decryptCredentials, encryptCredentials } from "../payments/crypto";
import { asaas, mapAsaasStatus } from "../payments/asaas";
import { mapMercadoPagoStatus, mercadopago, verifyMercadoPagoSignature } from "../payments/mercadopago";
import { enabledServiceProviders } from "../payments/registry";

const key = randomBytes(32).toString("base64");
const creds = { accessToken: "tok_123", webhookSecret: "segredo-webhook" };
const acc = { environment: "sandbox" as const, credentials: creds };
afterEach(() => vi.unstubAllGlobals());

describe("assinatura SaaS (Stripe)", () => {
  it("mapeia status sem liberar acesso antes da confirmação", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("incomplete")).toBeNull();
    expect(mapStripeStatus("incomplete_expired")).toBe("expired");
  });
  it("só aceita chave de produção quando liberada de propósito", () => {
    expect(stripeKeyMode("sk_test_abc", false)).toBe("test");
    expect(stripeKeyMode("sk_live_abc", false)).toBeNull();
    expect(stripeKeyMode("sk_live_abc", true)).toBe("live");
    expect(stripeKeyMode(undefined, true)).toBeNull();
  });
});

describe("credenciais criptografadas", () => {
  it("ida e volta, e falha com chave errada ou texto adulterado", () => {
    const enc = encryptCredentials(creds, key);
    expect(enc).not.toContain("tok_123");
    expect(decryptCredentials(enc, key)).toEqual(creds);
    expect(() => decryptCredentials(enc, randomBytes(32).toString("base64"))).toThrow();
    const parts = enc.split("."); parts[3] = Buffer.from("x").toString("base64");
    expect(() => decryptCredentials(parts.join("."), key)).toThrow();
  });
  it("exige chave de 32 bytes", () => expect(() => encryptCredentials(creds, "curta")).toThrow());
});

describe("provedores de pagamento de serviços", () => {
  it("nenhum provedor liberado por padrão", () => {
    expect(enabledServiceProviders("")).toEqual([]);
    expect(enabledServiceProviders("asaas, stripe ,mercadopago")).toEqual(["asaas", "mercadopago"]);
  });

  it("Asaas: status e webhook pelo token do header", () => {
    expect(mapAsaasStatus("RECEIVED")).toBe("paid");
    expect(mapAsaasStatus("OVERDUE")).toBe("expired");
    expect(mapAsaasStatus("PENDING", true)).toBe("canceled");
    const body = JSON.stringify({ id: "evt_1", event: "PAYMENT_RECEIVED", payment: { id: "pay_9", status: "RECEIVED" } });
    const req = (token: string) => ({ headers: new Headers({ "asaas-access-token": token }), rawBody: body, url: new URL("https://x/") });
    expect(asaas.verifyWebhook(req("errado"), creds)).toBeNull();
    expect(asaas.verifyWebhook(req("segredo-webhook"), creds)).toEqual({ eventId: "evt_1", externalId: "pay_9" });
  });

  it("Asaas: cria Pix com referência externa e sem dados de cartão", async () => {
    const calls: { url: string; body?: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: init.body as string, headers: init.headers as Record<string, string> });
      const json = url.includes("/customers?") ? { data: [] } : url.endsWith("/customers") ? { id: "cus_1" }
        : url.endsWith("/pixQrCode") ? { payload: "000201PIX", expirationDate: "2026-10-20 23:59:59" }
        : { id: "pay_1", status: "PENDING", value: 20, externalReference: "ref-1", invoiceUrl: "https://asaas/i/1", dueDate: "2026-10-20" };
      return new Response(JSON.stringify(json), { status: 200 });
    });
    const r = await asaas.createCharge(acc, { reference: "ref-1", amountCents: 2000, description: "Sinal corte", method: "pix", customer: { name: "João", document: "123.456.789-09" } });
    expect(r).toMatchObject({ externalId: "pay_1", status: "pending", pixCopyPaste: "000201PIX", amountCents: 2000 });
    expect(calls[0].url).toContain("api-sandbox.asaas.com");
    expect(calls[0].headers.access_token).toBe("tok_123");
    expect(JSON.parse(calls[2].body!)).toMatchObject({ customer: "cus_1", billingType: "PIX", value: 20, externalReference: "ref-1" });
  });

  it("Asaas: recusa sem CPF/CNPJ antes de chamar a API", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    await expect(asaas.createCharge(acc, { reference: "r", amountCents: 100, description: "x", method: "pix", customer: { name: "A" } })).rejects.toThrow(/CPF/);
    expect(f).not.toHaveBeenCalled();
  });

  it("Mercado Pago: status e assinatura x-signature", () => {
    expect(mapMercadoPagoStatus("approved")).toBe("paid");
    expect(mapMercadoPagoStatus("in_process")).toBe("pending");
    const ts = String(Math.floor(Date.now() / 1000));
    const v1 = createHmac("sha256", creds.webhookSecret).update(`id:123;request-id:req-1;ts:${ts};`).digest("hex");
    const h = (sig: string) => new Headers({ "x-signature": sig, "x-request-id": "req-1" });
    expect(verifyMercadoPagoSignature(h(`ts=${ts},v1=${v1}`), "123", creds.webhookSecret)).toBe(true);
    expect(verifyMercadoPagoSignature(h(`ts=${ts},v1=${"0".repeat(64)}`), "123", creds.webhookSecret)).toBe(false);
    expect(verifyMercadoPagoSignature(h(`ts=${ts},v1=${v1}`), "124", creds.webhookSecret)).toBe(false);
    expect(verifyMercadoPagoSignature(h(`ts=${Number(ts) - 3600},v1=${v1}`), "123", creds.webhookSecret)).toBe(false);
    const url = new URL("https://x/?data.id=123&type=payment");
    expect(mercadopago.verifyWebhook({ headers: h(`ts=${ts},v1=${v1}`), rawBody: "{}", url }, creds)).toEqual({ eventId: "req-1:123", externalId: "123" });
  });

  it("Mercado Pago: Pix com chave de idempotência", async () => {
    let sent: RequestInit | undefined;
    vi.stubGlobal("fetch", async (_: string, init: RequestInit) => {
      sent = init;
      return new Response(JSON.stringify({ id: 99, status: "pending", transaction_amount: 15.5, external_reference: "ref-2", date_approved: null, date_of_expiration: null, point_of_interaction: { transaction_data: { qr_code: "PIXMP" } } }));
    });
    const r = await mercadopago.createCharge(acc, { reference: "ref-2", amountCents: 1550, description: "Sinal", method: "pix", customer: { name: "Ana", email: "a@x.com" } });
    expect(r).toMatchObject({ externalId: "99", reference: "ref-2", pixCopyPaste: "PIXMP", amountCents: 1550 });
    expect((sent!.headers as Record<string, string>)["X-Idempotency-Key"]).toBe("ref-2");
  });
});
