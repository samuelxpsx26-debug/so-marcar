"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import { HelpTip } from "@/components/help-tip";
import { brl, formatDate } from "@/lib/format";
import { saveCoupon, toggleCoupon, type R } from "./actions";

export type Coupon = { id: string; code: string; kind: "percent" | "fixed"; value: number; expires_on: string | null; max_uses: number | null; once_per_customer: boolean; active: boolean; uses: number };

export const couponLabel = (k: Pick<Coupon, "kind" | "value">) => (k.kind === "percent" ? `${k.value}% de desconto` : `${brl(k.value)} de desconto`);

/** Cupons de desconto: o cliente digita na página de agendamento ou abre o link com o cupom já aplicado */
export function Coupons({ list, ready, bookingUrl, onUse }: { list: Coupon[]; ready: boolean; bookingUrl: string; onUse: (c: Coupon) => void }) {
  const [creating, setCreating] = useState(false);
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Cupons de desconto<HelpTip>Crie um código como VOLTA10. O cliente digita na sua página de agendamento, ou recebe o link com o cupom já aplicado. O desconto sai do preço do serviço e o sinal (se ligado) é calculado sobre o preço com desconto.</HelpTip></h2>
        {ready && !creating && <button type="button" onClick={() => setCreating(true)} className="btn btn-ghost shrink-0 whitespace-nowrap px-3 py-2 text-xs">+ Criar cupom</button>}
      </div>
      {!ready && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Para ativar os cupons, rode o arquivo supabase-cupons.sql no SQL Editor do Supabase.</p>}
      {creating && <CouponForm onDone={() => setCreating(false)} />}
      {ready && list.length === 0 && !creating && <p className="text-sm text-muted">Nenhum cupom ainda. Uma boa ideia é criar um para a campanha de quem não volta.</p>}
      <div className="divide-y divide-line">
        {list.map((k) => {
          const expired = !!k.expires_on && k.expires_on < new Date().toISOString().slice(0, 10);
          const full = k.max_uses !== null && k.uses >= k.max_uses;
          return (
            <div key={k.id} className={`flex flex-wrap items-center gap-2 py-2.5 text-sm ${k.active && !expired && !full ? "" : "opacity-60"}`}>
              <span className="min-w-0 flex-1">
                <span className="block font-mono font-bold">{k.code}</span>
                <span className="block text-xs text-muted">
                  {couponLabel(k)} · {k.uses} {k.uses === 1 ? "uso" : "usos"}{k.max_uses ? ` de ${k.max_uses}` : ""}{k.once_per_customer ? " · 1 por cliente" : ""}
                  {k.expires_on ? ` · ${expired ? "venceu" : "até"} ${formatDate(`${k.expires_on}T12:00:00Z`, "UTC", { day: "numeric", month: "short" })}` : ""}
                  {!k.active ? " · pausado" : full ? " · esgotado" : ""}
                </span>
              </span>
              {k.active && !expired && !full && <button type="button" onClick={() => { navigator.clipboard?.writeText(`${bookingUrl}?cupom=${k.code}`); onUse(k); }} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium">Usar na campanha</button>}
              <button type="button" disabled={pending} onClick={() => start(async () => { await toggleCoupon(k.id, !k.active); })} className="rounded-lg px-2.5 py-1.5 text-xs text-muted underline">{k.active ? "Pausar" : "Reativar"}</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CouponForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState<R, FormData>(saveCoupon, {});
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  useEffect(() => { if (state.ok) onDone(); }, [state.ok, onDone]);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-line p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label" htmlFor="code">Código</label><input id="code" name="code" className="field uppercase" placeholder="VOLTA10" maxLength={20} required /></div>
        <div>
          <label className="label" htmlFor="kind">Tipo</label>
          <select id="kind" name="kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as "percent" | "fixed")}>
            <option value="percent">% do valor</option>
            <option value="fixed">Valor em R$</option>
          </select>
        </div>
        <div><label className="label" htmlFor="value">{kind === "percent" ? "Desconto (%)" : "Desconto (R$)"}</label><input id="value" name="value" inputMode="decimal" className="field" placeholder={kind === "percent" ? "10" : "10,00"} required /></div>
        <div><label className="label" htmlFor="expires_on">Vale até (opcional)</label><input id="expires_on" name="expires_on" type="date" className="field" /></div>
        <div><label className="label" htmlFor="max_uses">Limite de usos (opcional)</label><input id="max_uses" name="max_uses" type="number" min={1} className="field" placeholder="Sem limite" /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="once" defaultChecked /> Cada cliente usa só uma vez</label>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2"><SubmitButton className="btn btn-primary flex-1">Salvar cupom</SubmitButton><button type="button" onClick={onDone} className="btn btn-ghost">Cancelar</button></div>
    </form>
  );
}
