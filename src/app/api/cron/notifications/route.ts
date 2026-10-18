import { NextResponse } from "next/server";
import { processNotifications } from "@/lib/notifications";
import { sendTrialNotices } from "@/lib/trial-notices";

// Chamado pelo Vercel Cron (vercel.json), que envia "Authorization: Bearer $CRON_SECRET".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const bookings = await processNotifications({ limit: 200 });
  const trialNotices = await sendTrialNotices().catch((e) => ({ error: String(e) }));
  return NextResponse.json({ bookings, trialNotices });
}
