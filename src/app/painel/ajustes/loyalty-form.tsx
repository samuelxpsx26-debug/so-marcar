"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { HelpTip } from "@/components/help-tip";
import type { Business } from "@/lib/business";
import { saveLoyalty, type R } from "./loyalty-actions";

/** Cartão fidelidade: a cada N atendimentos, um prêmio */
export function LoyaltyForm({ business: b }: { business: Business }) {
  const [state, action] = useActionState<R, FormData>(saveLoyalty, {});
  const [enabled, setEnabled] = useState(!!b.loyalty_visits);
  const [visits, setVisits] = useState(String(b.loyalty_visits ?? 10));
  const [reward, setReward] = useState(b.loyalty_reward ?? "");
  const n = Math.min(Math.max(Number(visits) || 0, 0), 50);
  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-bold">Cartão fidelidade<HelpTip>Cada atendimento marcado como &quot;Atendido&quot; vale um selo. Quando o cliente junta os selos, aparece &quot;Prêmio liberado&quot; na ficha dele em Clientes, e você toca em &quot;Entregar prêmio&quot; ao dar o brinde. O cliente vê os selos no link da reserva. Os atendimentos que ele já fez também contam.</HelpTip></h2>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-[var(--color-brand)]" />
        Dar um prêmio para quem volta sempre
      </label>
      {enabled && (
        <>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div><label className="label" htmlFor="visits">A cada</label>
              <div className="relative"><input id="visits" name="visits" type="number" min={2} max={50} value={visits} onChange={(e) => setVisits(e.target.value)} className="field pr-28" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">atendimentos</span></div>
            </div>
            <div><label className="label" htmlFor="reward">O cliente ganha</label><input id="reward" name="reward" value={reward} onChange={(e) => setReward(e.target.value)} maxLength={80} className="field" placeholder="Ex.: 1 corte grátis" /></div>
          </div>
          {n >= 2 && (
            <div className="rounded-2xl bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Como o cliente vê</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{Array.from({ length: n }).map((_, i) => <span key={i} className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i < Math.min(3, n - 1) ? "bg-brand text-white" : "border-2 border-dashed border-zinc-300 text-zinc-400"}`}>{i < Math.min(3, n - 1) ? "✓" : i + 1}</span>)}</div>
              <p className="mt-2 text-sm">Faltam {n - Math.min(3, n - 1)} para ganhar <strong>{reward || "o prêmio"}</strong></p>
            </div>
          )}
        </>
      )}
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-good">{enabled ? "Cartão fidelidade ligado." : "Cartão fidelidade desligado."}</p>}
      <SubmitButton className="btn btn-primary">Salvar cartão fidelidade</SubmitButton>
    </form>
  );
}
