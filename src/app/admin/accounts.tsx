"use client";
import { useMemo, useState } from "react";
import { accountsCsv, STAGE_LABEL, stageOf, waLink, type Account, type Stage } from "@/lib/admin-insights";
import { SEGMENTS, type Segment } from "@/lib/segments";

const STAGE_STYLE: Record<Stage, string> = {
  trial: "bg-violet-50 text-violet-700", trial_over: "bg-zinc-100 text-zinc-600", paying: "bg-emerald-50 text-emerald-700",
  past_due: "bg-red-50 text-red-700", canceled: "bg-zinc-100 text-zinc-500",
};

export function ago(ms: number, now: number) {
  const min = Math.floor((now - ms) / 60_000);
  if (min < 5) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Lista de todos os negócios com busca, filtro por situação e planilha */
export function AccountsTable({ list, now }: { list: Account[]; now: number }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage | "all">("all");
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter((a) => (stage === "all" || stageOf(a, now) === stage)
      && (!term || [a.name, a.slug, a.owner_name, a.owner_email, a.owner_phone].some((v) => v?.toLowerCase().includes(term))));
  }, [list, q, stage, now]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list.length };
    for (const a of list) { const s = stageOf(a, now); c[s] = (c[s] ?? 0) + 1; }
    return c;
  }, [list, now]);

  function download() {
    const blob = new Blob([accountsCsv(rows, now)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `clientes-so-marcar-${new Date(now).toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">Todos os cadastros</h2>
        <button type="button" onClick={download} className="btn btn-ghost px-3 py-2 text-sm">Baixar planilha</button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por negócio, nome, e-mail ou WhatsApp" className="field" />
      <div className="flex flex-wrap gap-2 text-xs">
        {(["all", "trial", "paying", "past_due", "trial_over", "canceled"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStage(s)} className={`rounded-full border px-3 py-1.5 font-medium ${stage === s ? "border-brand bg-brand text-white" : "border-line"}`}>
            {s === "all" ? "Todos" : STAGE_LABEL[s]} · {counts[s] ?? 0}
          </button>
        ))}
      </div>
      {rows.length === 0 && <p className="text-sm text-muted">Nenhum cadastro encontrado.</p>}
      <div className="divide-y divide-line">
        {rows.map((a) => {
          const s = stageOf(a, now);
          const wa = waLink(a.owner_phone, `Oi, ${(a.owner_name ?? "").split(" ")[0] || "tudo bem"}! Aqui é o Widney, do Só Marcar.`);
          const seen = a.last_seen_at ? ago(Date.parse(a.last_seen_at), now) : "nunca entrou no painel";
          return (
            <div key={a.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3 text-sm">
              <div className="min-w-0 flex-1 basis-60">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/${a.slug}`} target="_blank" className="font-semibold hover:underline">{a.name}</a>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_STYLE[s]}`}>{STAGE_LABEL[s]}{s === "paying" && a.paid_months ? ` · ${a.paid_months} ${a.paid_months === 1 ? "mês pago" : "meses pagos"}` : ""}</span>
                  {a.last_seen_at && now - Date.parse(a.last_seen_at) <= 5 * 60_000 && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" />online</span>}
                </div>
                <p className="mt-0.5 text-xs text-muted">{a.owner_name ?? "Sem nome"} · {a.owner_email ?? "sem e-mail"}{a.owner_phone ? ` · ${a.owner_phone}` : ""}</p>
                <p className="text-xs text-muted">{SEGMENTS[a.segment as Segment]?.label ?? a.segment} · cadastro em {new Date(a.created_at).toLocaleDateString("pt-BR")} · último acesso {seen}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs text-muted">
                <span><strong className="block text-base text-ink">{a.services}</strong>serviços</span>
                <span><strong className="block text-base text-ink">{a.appointments}</strong>agend.</span>
                <span><strong className="block text-base text-ink">{a.online_appointments}</strong>pelo link</span>
                {wa ? <a href={wa} target="_blank" className="rounded-lg bg-[#25D366] px-2.5 py-1.5 font-semibold text-white">WhatsApp</a>
                  : a.owner_email ? <a href={`mailto:${a.owner_email}`} className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-ink">E-mail</a> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
