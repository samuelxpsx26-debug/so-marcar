import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/business";
import { brl, formatDate, waLink } from "@/lib/format";
import { HelpTip } from "@/components/help-tip";

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
  const { supabase, business } = await getContext();
  const { q } = await searchParams;
  let query = supabase.from("customers").select("id, name, phone, email, notes, created_at, appointments(starts_at, status, price_cents, service:services(name))").eq("business_id", business.id).order("created_at", { ascending: false }).limit(200);
  if (q) {
    const term = q.replace(/[%_,()]/g, "").slice(0, 60);
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term.replace(/\D/g, "") || term}%`);
  }
  const { data } = await query;
  const rows = ((data ?? []) as unknown as Row[]).map((c) => {
    const done = c.appointments.filter((a) => a.status === "completed").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    const next = c.appointments.filter((a) => (a.status === "confirmed" || a.status === "pending") && new Date(a.starts_at) > new Date()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    return { ...c, visits: done.length, spent: done.reduce((s, a) => s + a.price_cents, 0), last: done[0]?.starts_at, next: next?.starts_at, noShows: c.appointments.filter((a) => a.status === "no_show").length, history: done.slice(0, 5) };
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
              {c.next ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-good">agendado</span> : c.noShows > 0 ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-bad">{c.noShows} falta{c.noShows > 1 ? "s" : ""}</span> : null}
            </summary>
            <div className="space-y-4 border-t border-line p-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <a target="_blank" href={waLink(c.phone, `Oi, ${c.name.split(" ")[0]}! Tudo bem?`)} className="btn bg-[#25D366] px-3 py-2 text-xs text-white">WhatsApp</a>
                <span className="self-center text-muted">+{c.phone}{c.email ? ` · ${c.email}` : ""}</span>
              </div>
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
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
