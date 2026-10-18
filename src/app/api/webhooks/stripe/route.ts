import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { billingConfigured, getStripe, stripeMode } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/sync";
import { finishWebhook, recordWebhook } from "@/lib/webhooks";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!billingConfigured()) return NextResponse.json({ error: "cobrança não configurada" }, { status: 503 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 400 });
  }
  // Evento de produção com chave de teste (ou o contrário) não vale
  if (event.livemode !== (stripeMode() === "live")) return NextResponse.json({ ignored: "modo diferente" });

  const db = createServiceClient();
  const obj = event.data.object as { id?: string; object?: string };
  const rec = await recordWebhook(db, "stripe", event.id, event.type, { type: event.type, object: obj.object, object_id: obj.id, livemode: event.livemode });
  if (rec.duplicate) return NextResponse.json({ duplicate: true });

  try {
    const result = await handleStripeEvent(db, event);
    await finishWebhook(db, rec.id, rec.attempts);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    await finishWebhook(db, rec.id, rec.attempts, e);
    console.error("stripe webhook", event.type, event.id, String(e));
    // 500 faz a Stripe tentar de novo mais tarde
    return NextResponse.json({ error: "falha ao processar" }, { status: 500 });
  }
}
