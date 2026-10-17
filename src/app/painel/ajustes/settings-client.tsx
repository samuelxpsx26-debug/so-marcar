"use client";
import { useActionState, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { Business } from "@/lib/business";
import { cancelSubscription, saveSettings, type R } from "./actions";

export function SettingsForm({ business: b }: { business: Business }) {
  const [state, action] = useActionState<R, FormData>(saveSettings, {});
  const addr = b.address?.text ?? "";
  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-bold">Seu negócio</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="name">Nome</label><input id="name" name="name" defaultValue={b.name} className="field" required /></div>
        <div><label className="label" htmlFor="whatsapp">WhatsApp</label><input id="whatsapp" name="whatsapp" defaultValue={b.whatsapp ?? ""} inputMode="tel" className="field" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="address">Endereço (aparece na página)</label><input id="address" name="address" defaultValue={addr} className="field" /></div>
      </div>
      <h2 className="pt-2 text-lg font-bold">Regras de agendamento</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Sel name="min_notice_minutes" label="Antecedência mínima para agendar" value={b.min_notice_minutes} opts={[[0, "Sem mínimo"], [30, "30 minutos"], [60, "1 hora"], [120, "2 horas"], [240, "4 horas"], [1440, "1 dia"]]} />
        <Sel name="max_days_ahead" label="Agenda aberta até" value={b.max_days_ahead} opts={[[7, "7 dias"], [14, "14 dias"], [30, "30 dias"], [60, "60 dias"], [90, "90 dias"]]} />
        <Sel name="slot_step_minutes" label="Horários de quanto em quanto tempo" value={b.slot_step_minutes} opts={[[10, "10 min"], [15, "15 min"], [20, "20 min"], [30, "30 min"], [60, "1 hora"]]} />
        <Sel name="cancel_notice_minutes" label="Cliente pode cancelar ou remarcar até" value={b.cancel_notice_minutes} opts={[[0, "A qualquer momento"], [60, "1 hora antes"], [120, "2 horas antes"], [240, "4 horas antes"], [720, "12 horas antes"], [1440, "1 dia antes"]]} />
      </div>
      <div><label className="label" htmlFor="cancellation_policy">Política de cancelamento (aparece para o cliente)</label><textarea id="cancellation_policy" name="cancellation_policy" rows={2} defaultValue={b.cancellation_policy ?? ""} className="field" placeholder="Ex.: Cancelamentos com menos de 2h de antecedência podem ser cobrados no próximo atendimento." /></div>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-good">Ajustes salvos.</p>}
      <SubmitButton className="btn btn-primary">Salvar ajustes</SubmitButton>
    </form>
  );
}

function Sel({ name, label, value, opts }: { name: string; label: string; value: number; opts: [number, string][] }) {
  const has = opts.some(([v]) => v === value);
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value} className="field">
        {!has && <option value={value}>{value}</option>}
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

export function CancelButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <button disabled={pending} onClick={() => confirm("Cancelar a assinatura? Sua agenda continua funcionando até o fim do período.") && start(async () => { const r = await cancelSubscription(); setMsg(r.error ?? "Assinatura cancelada."); })} className="text-sm font-medium text-bad underline">
        Cancelar assinatura
      </button>
      {msg && <p className="mt-1 text-sm">{msg}</p>}
    </div>
  );
}
