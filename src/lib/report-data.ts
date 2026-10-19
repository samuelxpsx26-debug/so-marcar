import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { ReportAppt } from "./reports";

type Db = Awaited<ReturnType<typeof createClient>>;
type Row = {
  starts_at: string; status: string; source: string; price_cents: number;
  customer: { id: string; name: string; phone: string; created_at: string } | null;
  service: { name: string } | null; professional: { name: string } | null;
};

/** Atendimentos desde uma data, paginando (o Supabase devolve no máximo 1000 linhas por vez) */
export async function loadReportAppts(supabase: Db, businessId: string, sinceIso: string): Promise<ReportAppt[]> {
  const out: ReportAppt[] = [];
  const page = 1000;
  for (let i = 0; i < 30; i++) {
    const { data, error } = await supabase.from("appointments")
      .select("starts_at, status, source, price_cents, customer:customers(id,name,phone,created_at), service:services(name), professional:professionals(name)")
      .eq("business_id", businessId).gte("starts_at", sinceIso).order("starts_at").range(i * page, i * page + page - 1);
    if (error || !data) break;
    for (const r of data as unknown as Row[]) {
      out.push({
        startsAt: r.starts_at, status: r.status, source: r.source, priceCents: r.price_cents,
        customerId: r.customer?.id ?? "", customerName: r.customer?.name ?? "Cliente", customerPhone: r.customer?.phone ?? "", customerCreatedAt: r.customer?.created_at ?? "",
        serviceName: r.service?.name ?? "Serviço", professionalName: r.professional?.name ?? "Profissional",
      });
    }
    if (data.length < page) break;
  }
  return out;
}
