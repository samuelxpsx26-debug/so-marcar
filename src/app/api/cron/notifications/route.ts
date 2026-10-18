import { NextResponse } from "next/server";
import { processNotifications } from "@/lib/notifications";

// Chamado pelo Vercel Cron (vercel.json), que envia "Authorization: Bearer $CRON_SECRET".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await processNotifications({ limit: 200 }));
}
