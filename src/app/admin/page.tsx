import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { brl, PLAN_PRICE_CENTS } from "@/lib/format";
import { Logo } from "@/components/logo";
import { SEGMENTS, type Segment } from "@/lib/segments";

const STATUS: Record<string, string> = { trialing: "Teste grátis", active: "Ativo", past_due: "Em atraso", canceled: "Cancelado", expired: "Expirado" };

export const metadata: Metadata = { title: "Painel do Só Marcar", robots: { index: false } };

async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = String(data?.claims?.email ?? "").toLowerCase();
  const allowed = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  if (!email || !allowed.includes(email)) notFound();
}

async function saveSpend(form: FormData) {
  "use server";
  await requireAdmin();
  const month = `${String(form.get("month"))}-01`;
  const channel = String(form.get("channel") ?? "").trim().slice(0, 60);
  const amount = Math.round(Number(String(form.get("amount") ?? "0").replace(/\./g, "").replace(",", ".")) * 100);
  if (!/^\d{4}-\d{2}-01$/.test(month) || channel.length < 2 || !Number.isFinite(amount) || amount < 0) return;
  await createServiceClient().from("marketing_spend").upsert({ month, channel, amount_cents: amount }, { onConflict: "month,channel" });
  revalidatePath("/admin");
}

type Summary = {
  businesses: number; new_businesses: number; trialing: number; active: number; past_due: number; canceled: number; mrr_cents: number;
  appointments: number; online_appointments: number; clients_revenue_cents: number; ad_spend_cents: number;
  top_businesses: { name: string; slug: string; segment: string; status: string; revenue_cents: number; appointments: number }[];
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireAdmin();
  const { m } = await searchParams;
  const now = new Date();
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : now.toISOString().slice(0, 7);
  const from = new Date(`${month}-01T03:00:00Z`);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 3));
  const admin = createServiceClient();
  const [{ data }, { data: spend }] = await Promise.all([
    admin.rpc("platform_summary", { p_from: from.toISOString(), p_to: to.toISOString() }),
    admin.from("marketing_spend").select("channel, amount_cents").eq("month", `${month}-01`).order("channel"),
  ]);
  const s = data as Summary;
  const cac = s.new_businesses ? s.ad_spend_cents / s.new_businesses : 0;
  // ROI estimado: receita recorrente do mês dos negócios pagantes sobre o investimento em anúncios
  const roi = s.ad_spend_cents ? (s.mrr_cents - s.ad_spend_cents) / s.ad_spend_cents : null;
  const conversion = s.active + s.canceled ? s.active / (s.active + s.canceled) : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Logo /><h1 className="mt-4 text-2xl font-bold">Painel do dono</h1></div>
        <form className="flex items-center gap-2"><input type="month" name="m" defaultValue={month} className="field py-2" /><button className="btn btn-ghost py-2">Ver</button></form>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Receita recorrente (MRR)" value={brl(s.mrr_cents)} hint={`${s.active} pagantes × ${brl(PLAN_PRICE_CENTS)}`} />
        <Kpi label="Clientes (negócios)" value={String(s.businesses)} hint={`${s.new_businesses} novos no mês · ${s.trialing} em teste`} />
        <Kpi label="Faturamento dos seus clientes" value={brl(s.clients_revenue_cents)} hint={`${s.appointments} atendimentos · ${s.online_appointments} pelo link`} />
        <Kpi label="ROI dos anúncios" value={roi === null ? "—" : `${Math.round(roi * 100)}%`} hint={`Investido ${brl(s.ad_spend_cents)} · CAC ${brl(Math.round(cac))}`} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Kpi label="Atraso de pagamento" value={String(s.past_due)} />
        <Kpi label="Cancelados" value={String(s.canceled)} />
        <Kpi label="Retenção (ativos ÷ ativos+cancelados)" value={`${Math.round(conversion * 100)}%`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card overflow-x-auto p-0">
          <h2 className="p-5 pb-2 font-bold">Negócios que mais faturam no mês</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-muted"><tr><th className="px-5 py-2">Negócio</th><th>Ramo</th><th>Plano</th><th className="text-right">Atend.</th><th className="px-5 text-right">Faturou</th></tr></thead>
            <tbody>
              {s.top_businesses.map((b) => (
                <tr key={b.slug} className="border-t border-line">
                  <td className="px-5 py-2"><a href={`/${b.slug}`} target="_blank" className="font-medium hover:underline">{b.name}</a></td>
                  <td>{SEGMENTS[b.segment as Segment]?.label ?? b.segment}</td><td>{STATUS[b.status] ?? b.status}</td><td className="text-right">{b.appointments}</td><td className="px-5 text-right font-semibold">{brl(b.revenue_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card space-y-3">
          <h2 className="font-bold">Investimento em anúncios</h2>
          <ul className="space-y-1 text-sm">{(spend ?? []).map((x) => <li key={x.channel} className="flex justify-between"><span>{x.channel}</span><span>{brl(x.amount_cents)}</span></li>)}</ul>
          <form action={saveSpend} className="space-y-2">
            <input type="hidden" name="month" value={month} />
            <input name="channel" placeholder="Canal (ex.: Meta Ads)" className="field py-2" required />
            <input name="amount" placeholder="Valor R$" inputMode="decimal" className="field py-2" required />
            <button className="btn btn-primary w-full py-2">Salvar</button>
          </form>
          <p className="text-xs text-muted">ROI = (MRR − investimento) ÷ investimento. CAC = investimento ÷ negócios novos no mês.</p>
        </section>
      </div>
    </main>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
