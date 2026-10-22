"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { HelpTip } from "@/components/help-tip";
import { brl } from "@/lib/format";
import { depositCents, PIX_KEY_LABEL, type PixKeyType } from "@/lib/pix";
import type { Business } from "@/lib/business";
import { saveDeposit, type R } from "./deposit-actions";

const HOLDS: [number, string][] = [[15, "15 minutos"], [30, "30 minutos"], [60, "1 hora"], [120, "2 horas"], [360, "6 horas"], [1440, "24 horas"]];
const PLACEHOLDER: Record<PixKeyType, string> = { cpf: "000.000.000-00", cnpj: "00.000.000/0000-00", telefone: "(11) 99999-9999", email: "voce@email.com", aleatoria: "1a2b3c4d-..." };

/** Sinal por Pix: o cliente paga na chave do próprio dono para garantir o horário */
export function DepositForm({ business: b, examplePriceCents }: { business: Business; examplePriceCents: number }) {
  const [state, action] = useActionState<R, FormData>(saveDeposit, {});
  const [enabled, setEnabled] = useState((b.deposit_mode ?? "off") !== "off");
  const [mode, setMode] = useState<"percent" | "fixed">(b.deposit_mode === "fixed" ? "fixed" : "percent");
  const [percent, setPercent] = useState(b.deposit_mode === "percent" ? String(b.deposit_value) : "30");
  const [fixed, setFixed] = useState(b.deposit_mode === "fixed" ? ((b.deposit_value ?? 0) / 100).toFixed(2).replace(".", ",") : "20,00");
  const [keyType, setKeyType] = useState<PixKeyType>(b.pix_key_type ?? "telefone");
  const value = mode === "percent" ? Number(percent) || 0 : Math.round(Number(fixed.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  const example = depositCents(mode, value, examplePriceCents);

  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-bold">Sinal por Pix<HelpTip tutorial="sinal-pix">Para diminuir faltas: o cliente paga um sinal no Pix para garantir o horário. O dinheiro cai direto na sua conta, sem passar pelo Só Marcar e sem taxa. Você confere no app do banco e toca em &quot;Sinal recebido&quot; na agenda.</HelpTip></h2>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-[var(--color-brand)]" />
        Cobrar sinal para garantir o horário
      </label>
      {enabled && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="mode">Valor do sinal<HelpTip>Porcentagem do preço do serviço (ex.: 30% de um corte de R$ 50 = R$ 15) ou um valor fixo igual para todos. O sinal nunca passa do preço do serviço.</HelpTip></label>
              <div className="flex gap-2">
                <select id="mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value as "percent" | "fixed")} className="field">
                  <option value="percent">Porcentagem</option>
                  <option value="fixed">Valor fixo</option>
                </select>
                {mode === "percent"
                  ? <div className="relative w-28 shrink-0"><input aria-label="Porcentagem" name="percent" inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)} className="field pr-7" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span></div>
                  : <div className="relative w-32 shrink-0"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span><input aria-label="Valor fixo" name="fixed" inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} className="field pl-9" /></div>}
              </div>
              {examplePriceCents > 0 && example > 0 && <p className="mt-1 text-xs text-muted">Ex.: serviço de {brl(examplePriceCents)}: paga {brl(example)} agora e {brl(examplePriceCents - example)} no dia.</p>}
            </div>
            <div>
              <label className="label" htmlFor="hold">Prazo para pagar<HelpTip>Quanto tempo o horário fica guardado esperando o Pix. Se o sinal não for confirmado nesse prazo, o horário volta a ficar livre para outra pessoa (e quem estiver na lista de espera aparece em &quot;Hoje&quot;).</HelpTip></label>
              <select id="hold" name="hold" defaultValue={HOLDS.some(([v]) => v === b.deposit_hold_minutes) ? b.deposit_hold_minutes : 60} className="field">
                {HOLDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="key_type">Tipo de chave</label>
              <select id="key_type" name="key_type" value={keyType} onChange={(e) => setKeyType(e.target.value as PixKeyType)} className="field">
                {(Object.keys(PIX_KEY_LABEL) as PixKeyType[]).map((k) => <option key={k} value={k}>{PIX_KEY_LABEL[k]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="key">Chave Pix<HelpTip>A chave da conta onde você quer receber. Ela só aparece para o cliente depois que ele reserva, junto com o QR Code e o Pix copia e cola já com o valor.</HelpTip></label>
              <input id="key" name="key" defaultValue={b.pix_key ?? ""} placeholder={PLACEHOLDER[keyType]} className="field" autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="holder">Nome de quem recebe<HelpTip>O nome do titular da conta, como aparece no banco. O cliente vê esse nome na hora de pagar e fica tranquilo de que está pagando a pessoa certa.</HelpTip></label>
              <input id="holder" name="holder" defaultValue={b.pix_holder ?? ""} placeholder="Ex.: José da Silva" className="field" maxLength={60} />
            </div>
            <div>
              <label className="label" htmlFor="city">Cidade</label>
              <input id="city" name="city" defaultValue={b.pix_city ?? ""} placeholder="Ex.: São Paulo" className="field" maxLength={40} />
            </div>
          </div>
          <p className="rounded-xl bg-violet-50 p-3 text-xs text-violet-900">Quem reserva vê o QR Code e o Pix copia e cola com o valor certo. A reserva fica &quot;aguardando sinal&quot; na sua agenda até você tocar em &quot;Sinal recebido&quot;.</p>
        </>
      )}
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-good">{enabled ? "Sinal ligado." : "Sinal desligado."}</p>}
      <SubmitButton className="btn btn-primary">Salvar sinal</SubmitButton>
    </form>
  );
}
