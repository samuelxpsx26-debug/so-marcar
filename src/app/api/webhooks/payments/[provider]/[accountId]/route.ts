import { NextResponse } from "next/server";
import { loadPaymentAccount, reconcilePayment } from "@/lib/payments/service";
import { finishWebhook, recordWebhook } from "@/lib/webhooks";
import { createServiceClient } from "@/lib/supabase/server";

// Webhook de pagamentos de serviços. Cada conta de estabelecimento tem a própria URL e o próprio segredo.
export async function POST(request: Request, { params }: { params: Promise<{ provider: string; accountId: string }> }) {
  const { provider, accountId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const db = createServiceClient();
  const acc = await loadPaymentAccount(db, accountId, provider);
  if (!acc) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const rawBody = await request.text();
  const notice = acc.provider.verifyWebhook({ headers: request.headers, rawBody, url: new URL(request.url) }, acc.account.credentials);
  if (!notice) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  if ("ignore" in notice) return NextResponse.json({ ignored: true });

  const rec = await recordWebhook(db, provider, `${accountId}:${notice.eventId}`, "payment", { account: accountId, external_id: notice.externalId });
  if (rec.duplicate) return NextResponse.json({ duplicate: true });
  try {
    const result = await reconcilePayment(db, acc, notice.externalId, "webhook");
    await finishWebhook(db, rec.id, rec.attempts);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    await finishWebhook(db, rec.id, rec.attempts, e);
    console.error("payment webhook", provider, accountId, String(e));
    return NextResponse.json({ error: "falha ao processar" }, { status: 500 });
  }
}
