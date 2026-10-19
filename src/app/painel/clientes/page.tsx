import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { canManage, getContext } from "@/lib/business";
import { addDays, brl, formatDate, localDate, waLink } from "@/lib/format";
import { HelpTip } from "@/components/help-tip";
import { loyaltyCard, packageUsable, type CustomerPackage } from "@/lib/loyalty";
import { redeemLoyalty, sellPackage } from "./actions";
import { MergeForm } from "./merge-form";
import { ClubBox } from "./club-box";
import { clubUsed, type ClubMember, type ClubPlan } from "@/lib/club";

export const metadata: Metadata = { title: "Clientes" };

type Row = { id: string; name: string; phone: string; email: string | null; notes: string | null; created_at: string; appointments: { starts_at: string; status: string; price_cents: number; service: { name: string } | null }[] };

async function saveNotes(form: FormData) {
  "use server";
  const { supabase, business } = await getContext();
  const id = String(form.get("id"));
  const notes = String(form.get("notes") ?? "").slice(0, 2000);
  await supabase.from("customers").update({ notes: notes || null }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/painel/clientes");
}

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, business, role } = await getContext();
  const { q } = await searchParams;
  let query = supabase.from("customers").select("id, name, phone, email, notes, created_at, appointments(starts_at, status, price_cents, service:services(name))").eq("business_id", business.id).order("created_at", { ascending: false }).limit(200);
  if (q) {
    const term = q.replace(/[%_,()]/g, "").slice(0, 60);
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term.replace(/\D/g, "") || term}%`);
  }
  const [{ data }, redemptions, owned, catalog] = await Promise.all([
    query,
    // Tabelas de fidelidade e pacotes podem não existir ainda (SQL não rodado): tratamos como vazias
    supabase.from("loyalty_redemptions").select("customer_id, visits_used").eq("business_id", business.id),
    supabase.from("customer_packages").select("id, customer_id, service_id, name, sessions_total, sessions_used, price_cents, expires_at, created_at").eq("business_id", business.id).order("created_at", { ascending: false }),
    supabase.from("packages").select("id, name, price_cents, sessions").eq("business_id", business.id).eq("active", true).order("price_cents"),
  ]);
  // Clube mensal (tabelas podem não existir antes do SQL do clube)
  const today = localDate(new Date(), business.timezone);
  const [clubPlans, clubMembers, clubUse] = await Promise.all([
    supabase.from("club_plans").select("id, name, price_cents, sessions_per_month, service_ids, active").eq("business_id", business.id).eq("active", true).order("price_cents"),
    supabase.from("club_members").select("id, customer_id, plan_id, name, price_cents, sessions_per_month, service_ids, status, started_on, paid_until").eq("business_id", business.id).eq("status", "active"),
    supabase.from("appointments").select("club_member_id, starts_at").eq("business_id", business.id).not("club_member_id", "is", null).gte("starts_at", `${addDays(today, -62)}T00:00:00Z`),
  ]);
  const memberOf = new Map<string, ClubMember>();
  for (const m of (clubMembers.data ?? []) as ClubMember[]) memberOf.set(m.customer_id, m);
  const useRows = (clubUse.data ?? []) as { club_member_id: string; starts_at: string }[];
  const usedBy = (m: ClubMember | undefined) => (m ? clubUsed(m, useRows, (iso) => localDate(new Date(iso), business.timezone)) : 0);
  const used = new Map<string, number>();
  for (const r of (redemptions.data ?? []) as { customer_id: string; visits_used: number }[]) used.set(r.customer_id, (used.get(r.customer_id) ?? 0) + r.visits_used);
  const packagesOf = new Map<string, CustomerPackage[]>();
  for (const k of (owned.data ?? []) as CustomerPackage[]) packagesOf.set(k.customer_id, [...(packagesOf.get(k.customer_id) ?? []), k]);
  const loyaltyOn = !!business.loyalty_visits && !redemptions.error;
  const offers = (catalog.data ?? []) as { id: string; name: string; price_cents: number; sessions: number }[];
  const rows = ((data ?? []) as unknown as Row[]).map((c) => {
    const done = c.appointments.filter((a) => a.status === "completed").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    const next = c.appointments.filter((a) => (a.status === "confirmed" || a.status === "pending") && new Date(a.starts_at) > new Date()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    const card = loyaltyOn ? loyaltyCard(Math.max(0, done.length - (used.get(c.id) ?? 0)), business.loyalty_visits!) : null;
    return { ...c, card, packages: packagesOf.get(c.id) ?? [], visits: done.length, spent: done.reduce((s, a) => s + a.price_cents, 0), last: done[0]?.starts_at, next: next?.starts_at, noShows: c.appointments.filter((a) => a.status === "no_show").length, history: done.slice(0, 5) };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes<HelpTip>Todo mundo que já marcou com você, com telefone, visitas e quanto gastou. Os clientes entram aqui sozinhos quando agendam pela sua página.</HelpTip></h1>
          <p className="text-sm text-muted">{rows.length} {rows.length === 1 ? "cliente" : "clientes"}{q ? ` para “${q}”` : ""}</p>
        </div>
        <form className="w-full sm:w-72"><input name="q" defaultValue={q} placeholder="Buscar por nome ou telefone" className="field py-2.5" /></form>
      </div>
      <div className="space-y-2">
        {rows.length === 0 && <div className="card text-sm text-muted">Seus clientes aparecem aqui assim que agendarem pelo link ou você cadastrar um atendimento.</div>}
        {rows.map((c) => (
          <details key={c.id} className="card group p-0">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-100 font-semibold">{c.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.name}</span>
                <span className="block truncate text-sm text-muted">
                  {c.visits} {c.visits === 1 ? "visita" : "visitas"} · {brl(c.spent)}{c.last ? ` · última ${formatDate(c.last, business.timezone, { day: "numeric", month: "short" })}` : ""}
                </span>
              </span>
              {memberOf.has(c.id) && <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">clube</span>}
              {c.card && c.card.rewards > 0 && <span className="rounded-full bg-fuchsia-50 px-2 py-1 text-xs font-medium text-fuchsia-700">🎁 prêmio</span>}
              {c.next ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-good">agendado</span> : c.noShows > 0 ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-bad">{c.noShows} falta{c.noShows > 1 ? "s" : ""}</span> : null}
            </summary>
            <div className="space-y-4 border-t border-line p-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <a target="_blank" href={waLink(c.phone, `Oi, ${c.name.split(" ")[0]}! Tudo bem?`)} className="btn bg-[#25D366] px-3 py-2 text-xs text-white">WhatsApp</a>
                <span className="self-center text-muted">+{c.phone}{c.email ? ` · ${c.email}` : ""}</span>
              </div>
              {c.card && (
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Cartão fidelidade</p>
                  <div className="mt-2 flex flex-wrap gap-1">{Array.from({ length: business.loyalty_visits! }).map((_, i) => <span key={i} className={`h-5 w-5 rounded-full ${i < c.card!.filled ? "bg-brand" : "border-2 border-dashed border-zinc-300"}`} />)}</div>
                  {c.card.rewards > 0 ? (
                    <form action={redeemLoyalty} className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="customer_id" value={c.id} />
                      <span className="font-semibold text-fuchsia-700">🎁 Prêmio liberado: {business.loyalty_reward}{c.card.rewards > 1 ? ` (${c.card.rewards}×)` : ""}</span>
                      <button className="btn btn-primary px-3 py-1.5 text-xs">Entregar prêmio</button>
                    </form>
                  ) : <p className="mt-2 text-muted">Faltam {c.card.missing} {c.card.missing === 1 ? "atendimento" : "atendimentos"} para {business.loyalty_reward}.</p>}
                </div>
              )}
              <ClubBox customerId={c.id} member={memberOf.get(c.id) ?? null} used={usedBy(memberOf.get(c.id))} plans={(clubPlans.data ?? []) as ClubPlan[]} today={today} />
              {(c.packages.length > 0 || offers.length > 0) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pacotes</p>
                  {c.packages.map((k) => {
                    const ok = packageUsable(k);
                    return (
                      <p key={k.id} className={`flex justify-between gap-2 ${ok ? "" : "text-muted"}`}>
                        <span>{k.name}</span>
                        <span>{k.sessions_total - k.sessions_used} de {k.sessions_total} restantes{k.expires_at ? ` · ${new Date(k.expires_at) < new Date() ? "venceu" : "vence"} ${formatDate(k.expires_at, business.timezone, { day: "numeric", month: "short" })}` : ""}</span>
                      </p>
                    );
                  })}
                  {offers.length > 0 && (
                    <form action={sellPackage} className="flex gap-2">
                      <input type="hidden" name="customer_id" value={c.id} />
                      <select name="package_id" aria-label="Pacote" className="field py-2 text-sm">{offers.map((o) => <option key={o.id} value={o.id}>{o.name} · {brl(o.price_cents)}</option>)}</select>
                      <button className="btn btn-ghost shrink-0 px-3 py-2 text-xs">Vender pacote</button>
                    </form>
                  )}
                </div>
              )}
              {c.history.length > 0 && (
                <ul className="space-y-1">
                  {c.history.map((h, i) => <li key={i} className="flex justify-between"><span>{formatDate(h.starts_at, business.timezone, { day: "numeric", month: "short", year: "2-digit" })} · {h.service?.name}</span><span className="text-muted">{brl(h.price_cents)}</span></li>)}
                </ul>
              )}
              <form action={saveNotes} className="space-y-2">
                <input type="hidden" name="id" value={c.id} />
                <label className="label" htmlFor={`n-${c.id}`}>Preferências e observações</label>
                <textarea id={`n-${c.id}`} name="notes" rows={2} defaultValue={c.notes ?? ""} className="field" placeholder="Ex.: prefere máquina 2 nas laterais" />
                <button className="btn btn-ghost px-3 py-2 text-xs">Salvar</button>
              </form>
              {canManage(role) && <MergeForm keep={{ id: c.id, name: c.name }} others={rows.filter((o) => o.id !== c.id).map((o) => ({ id: o.id, name: o.name, phone: o.phone, visits: o.visits }))} />}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
