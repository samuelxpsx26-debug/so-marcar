"use client";
import { useState, useTransition } from "react";
import { mergeCustomer } from "./actions";

/** Ficha repetida (cliente que digitou outro número): traz as visitas da outra ficha para esta */
export function MergeForm({ keep, others }: { keep: { id: string; name: string }; others: { id: string; name: string; phone: string; visits: number }[] }) {
  const [dupId, setDupId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (others.length === 0) return null;
  const dup = others.find((o) => o.id === dupId);

  function merge() {
    if (!dup) return;
    if (!confirm(`Juntar "${dup.name}" (+${dup.phone}) em "${keep.name}"?\n\nAs visitas, pacotes e selos passam para esta ficha e a outra é apagada. Não dá para desfazer.`)) return;
    setError(null);
    start(async () => {
      const r = await mergeCustomer(keep.id, dup.id);
      if (r.error) setError(r.error);
      else setDupId("");
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ficha repetida?</p>
      <div className="flex gap-2">
        <select value={dupId} onChange={(e) => setDupId(e.target.value)} aria-label="Ficha para juntar" className="field py-2 text-sm">
          <option value="">Juntar outra ficha nesta…</option>
          {others.map((o) => <option key={o.id} value={o.id}>{o.name} · +{o.phone} · {o.visits} {o.visits === 1 ? "visita" : "visitas"}</option>)}
        </select>
        <button type="button" onClick={merge} disabled={!dup || pending} className="btn btn-ghost shrink-0 px-3 py-2 text-xs disabled:opacity-50">{pending ? "Juntando…" : "Juntar"}</button>
      </div>
      {error && <p role="alert" className="text-bad">{error}</p>}
    </div>
  );
}
