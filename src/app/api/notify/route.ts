import { NextResponse } from "next/server";
import { processNotifications } from "@/lib/notifications";

// Dispara na hora a confirmação de uma reserva recém-criada ou remarcada.
// Só envia o que já está pendente e vencido para aquele token, então não há o que abusar.
export async function POST(request: Request) {
  const { token } = await request.json().catch(() => ({}));
  if (typeof token !== "string" || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: "token inválido" }, { status: 400 });
  }
  try {
    const r = await processNotifications({ manageToken: token, limit: 5 });
    return NextResponse.json({ sent: r.sent });
  } catch (e) {
    console.error("notify", String(e));
    return NextResponse.json({ sent: 0 }, { status: 500 });
  }
}
