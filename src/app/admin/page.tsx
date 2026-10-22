import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { brl } from "@/lib/format";
import { Logo } from "@/components/logo";
import { SEGMENTS, type Segment } from "@/lib/segments";
import { alertsFor, cohorts, summarize, waLink, type Account } from "@/lib/admin-insights";
import { AccountsTable } from "./accounts";

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
  new_businesses: number; appointments: number; online_appointments: number; clients_revenue_cents: number; ad_spend_cents: number;
  top_businesses: { name: string; slug: string; segment: string; status: string; revenue_cents: number; appointments: number }[];
};

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const monthName = (m: string) => {
  const s = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-15T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireAdmin();
  const { m } = await searchParams;
  const now = new Date().getTime();
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : new Date(now - 3 * 3_600_000).toISOString().slice(0, 7);
  const from = new Date(`${month}-01T03:00:00Z`);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 3));
  const admin = createServiceClient();
  const [{ data }, { data: spend }, accountsRes] = await Promise.all([
    admin.rpc("platform_summary", { p_from: from.toISOString(), p_to: to.toISOString() }),
    admin.from("marketing_spend").select("channel, amount_cents").eq("month", `${month}-01`).order("channel"),
    admin.rpc("platform_accounts"),
  ]);
  const { data: suggestions } = await admin.from("suggestions").select("id, business_id, body, created_at").order("created_at", { ascending: false }).limit(30);
  const s = data as Summary;
  const ready = !accountsRes.error;
  const list = (accountsRes.data ?? []) as Account[];
  const t = summarize(list, now);
  const alerts = alertsFor(list, now);
  const safras = cohorts(list);
  const cac = s.new_businesses ? s.ad_spend_cents / s.new_businesses : 0;
  const roi = s.ad_spend_cents ? (t.mrrCents - s.ad_spend_cents) / s.ad_spend_cents : null;
  const top = Math.max(1, t.funnel[0].n);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Logo /><h1 className="mt-4 text-2xl font-bold">Painel do dono</h1><p className="text-sm text-muted">Só você vê esta página.</p></div>
      </div>

      {!ready && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Para ver cadastros, acessos e pagamentos, rode o arquivo supabase-painel-dono.sql no SQL Editor do Supabase.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Usando agora" value={String(t.onlineNow)} hint={`${t.activeToday} hoje · ${t.active7} nos últimos 7 dias`} live={t.onlineNow > 0} />
        <Kpi label="Cadastros" value={String(t.total)} hint={`+${t.newLast7} nos últimos 7 dias`} />
        <Kpi label="Pagantes" value={String(t.paying)} hint={`${t.trial} em teste · ${t.pastDue} em atraso`} />
        <Kpi label="Receita por mês" value={brl(t.mrrCents)} hint="assinaturas ativas e em atraso" />
        <Kpi label="Pagaram o 2º mês" value={String(t.paidTwice)} hint={`${pct(t.secondMonthRate)} de quem pagou o 1º (${t.paidOnce})`} />
        <Kpi label="Teste acabou sem assinar" value={String(t.trialOver)} hint="vale um contato" />
        <Kpi label="Cancelados" value={String(t.canceled)} />
        <Kpi label="Custo por cadastro" value={brl(Math.round(cac))} hint={`ROI dos anúncios ${pct(roi)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="card min-w-0 space-y-3">
          <h2 className="font-bold">Precisa de você <span className="font-normal text-muted">· {alerts.length}</span></h2>
          {alerts.length === 0 && <p className="text-sm text-muted">Ninguém precisando de contato agora.</p>}
          <div className="divide-y divide-line">
            {alerts.slice(0, 12).map((a) => {
              const wa = waLink(a.account.owner_phone, a.message);
              return (
                <div key={`${a.kind}-${a.account.id}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{a.account.name}</span>
                    <span className={`block text-xs font-medium ${a.kind === "past_due" || a.kind === "trial_ending" ? "text-red-600" : "text-amber-700"}`}>{a.text}</span>
                  </span>
                  {wa ? <a href={wa} target="_blank" className="shrink-0 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-semibold text-white">Chamar</a>
                    : a.account.owner_email && <a href={`mailto:${a.account.owner_email}`} className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold">E-mail</a>}
                </div>
              );
            })}
          </div>
          {alerts.length > 12 && <p className="text-xs text-muted">E mais {alerts.length - 12}. Veja todos na lista de cadastros.</p>}
        </section>

        <section className="card min-w-0 space-y-3">
          <h2 className="font-bold">Funil</h2>
          <ul className="space-y-3 text-sm">
            {t.funnel.map((f, i) => (
              <li key={f.label}>
                <div className="flex justify-between gap-2"><span>{f.label}</span><span><strong>{f.n}</strong>{i > 0 && <span className="text-muted"> · {pct(t.funnel[i - 1].n ? f.n / t.funnel[i - 1].n : null)}</span>}</span></div>
                <div className="mt-1 h-2.5 rounded-full bg-zinc-100"><div className="h-2.5 rounded-full bg-brand" style={{ width: `${Math.max(2, (f.n / top) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">A porcentagem é sobre a etapa anterior. A maior queda é onde vale agir primeiro.</p>
        </section>
      </div>

      <section className="card min-w-0 space-y-3">
        <h2 className="font-bold">Sugestões dos lojistas <span className="font-normal text-muted">· {suggestions?.length ?? 0}</span></h2>
        {!suggestions?.length && <p className="text-sm text-muted">Nenhuma sugestão ainda. Elas chegam pela área Aprender do painel.</p>}
        <div className="divide-y divide-line">
          {(suggestions ?? []).map((x) => {
            const acc = list.find((a) => a.id === x.business_id);
            const wa = waLink(acc?.owner_phone ?? null, `Oi, ${(acc?.owner_name ?? "").split(" ")[0] || "tudo bem"}! Aqui é o Widney, do Só Marcar. Vi sua sugestão: "${x.body.slice(0, 120)}". Obrigado!`);
            return (
              <div key={x.id} className="flex items-start gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-pre-line">{x.body}</span>
                  <span className="mt-1 block text-xs text-muted">{acc?.name ?? "Negócio"} · {new Date(x.created_at).toLocaleDateString("pt-BR")}</span>
                </span>
                {wa && <a href={wa} target="_blank" className="shrink-0 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-semibold text-white">Responder</a>}
              </div>
            );
          })}
        </div>
      </section>

      <AccountsTable list={list} now={now} />

      {safras.length > 0 && (
        <section className="card min-w-0 overflow-x-auto">
          <h2 className="font-bold">Por mês de cadastro</h2>
          <table className="mt-3 w-full min-w-[480px] text-sm">
            <thead className="text-left text-muted"><tr><th className="py-2">Mês</th><th className="text-right">Cadastros</th><th className="text-right">Configuraram</th><th className="text-right">Pagaram 1º</th><th className="text-right">Pagaram 2º</th></tr></thead>
            <tbody>
              {safras.map((r) => (
                <tr key={r.month} className="border-t border-line">
                  <td className="py-2">{monthName(r.month)}</td><td className="text-right">{r.signups}</td>
                  <td className="text-right">{r.setup} <span className="text-muted">({pct(r.setup / r.signups)})</span></td>
                  <td className="text-right">{r.paid1} <span className="text-muted">({pct(r.paid1 / r.signups)})</span></td>
                  <td className="text-right">{r.paid2} <span className="text-muted">({pct(r.paid1 ? r.paid2 / r.paid1 : null)})</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 className="text-lg font-bold">Mês de {monthName(month)}</h2>
        <form className="flex items-center gap-2"><input type="month" name="m" defaultValue={month} className="field py-2" /><button className="btn btn-ghost py-2">Ver</button></form>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card min-w-0 overflow-x-auto p-0">
          <h2 className="p-5 pb-2 font-bold">Negócios que mais faturam no mês</h2>
          <p className="px-5 text-xs text-muted">{s.appointments} atendimentos na plataforma · {s.online_appointments} pelo link · {brl(s.clients_revenue_cents)} faturados pelos seus clientes</p>
          <table className="mt-2 w-full min-w-[520px] text-sm">
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
          <p className="text-xs text-muted">Custo por cadastro = investimento ÷ negócios novos no mês ({s.new_businesses}). ROI = (receita por mês − investimento) ÷ investimento.</p>
        </section>
      </div>
    </main>
  );
}

function Kpi({ label, value, hint, live }: { label: string; value: string; hint?: string; live?: boolean }) {
  return (
    <div className="card min-w-0">
      <p className="flex items-center gap-1.5 text-sm text-muted">{live && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
