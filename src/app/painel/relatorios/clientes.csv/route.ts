import { canManage, getContext } from "@/lib/business";
import { formatDate } from "@/lib/format";

type Row = { name: string; phone: string; email: string | null; marketing_consent: boolean; created_at: string; appointments: { starts_at: string; status: string; price_cents: number }[] };

const cell = (v: string | number) => {
  const s = String(v);
  // Aspas e proteção contra fórmulas ao abrir no Excel/Planilhas
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Planilha (CSV, separada por ponto e vírgula para abrir certo no Excel em português) */
export async function GET() {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return new Response("Sem permissão", { status: 403 });
  const rows: Row[] = [];
  for (let i = 0; i < 20; i++) {
    const { data } = await supabase.from("customers").select("name, phone, email, marketing_consent, created_at, appointments(starts_at, status, price_cents)")
      .eq("business_id", business.id).order("name").range(i * 1000, i * 1000 + 999);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  const tz = business.timezone;
  const lines = [["Nome", "WhatsApp", "E-mail", "Aceita avisos", "Visitas", "Faltas", "Total gasto (R$)", "Última visita", "Cliente desde"].join(";")];
  for (const c of rows) {
    const done = c.appointments.filter((a) => a.status === "completed").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    lines.push([
      c.name, c.phone, c.email ?? "", c.marketing_consent ? "sim" : "não", done.length, c.appointments.filter((a) => a.status === "no_show").length,
      (done.reduce((s, a) => s + a.price_cents, 0) / 100).toFixed(2).replace(".", ","),
      done[0] ? formatDate(done[0].starts_at, tz, { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
      formatDate(c.created_at, tz, { day: "2-digit", month: "2-digit", year: "numeric" }),
    ].map(cell).join(";"));
  }
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="clientes-${business.slug}.csv"`, "Cache-Control": "no-store" },
  });
}
