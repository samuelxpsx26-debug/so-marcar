"use client";
import { useActionState, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import { HelpTip } from "@/components/help-tip";
import type { Business } from "@/lib/business";
import { cancelSubscription, saveSettings, type R } from "./actions";

export function SettingsForm({ business: b }: { business: Business }) {
  const [state, action] = useActionState<R, FormData>(saveSettings, {});
  const addr = b.address?.text ?? "";
  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-bold">Seu negócio<HelpTip>Esses dados aparecem na sua página de agendamento para os clientes.</HelpTip></h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="name">Nome<HelpTip>O nome do seu negócio, do jeito que o cliente conhece. Aparece no topo da página e nos e-mails.</HelpTip></label><input id="name" name="name" defaultValue={b.name} className="field" required /></div>
        <div><label className="label" htmlFor="whatsapp">WhatsApp<HelpTip>Com DDD, só números (ex.: 11 91234-5678). Vira o botão &quot;Falar no WhatsApp&quot; na sua página. Deixe vazio para esconder o botão.</HelpTip></label><input id="whatsapp" name="whatsapp" defaultValue={b.whatsapp ?? ""} inputMode="tel" className="field" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="address">Endereço (aparece na página)<HelpTip>Rua, número e bairro. Aparece embaixo do nome com um ícone de mapa. Se você atende a domicílio, pode escrever &quot;Atendo a domicílio na região X&quot;.</HelpTip></label><input id="address" name="address" defaultValue={addr} className="field" /></div>
      </div>
      <h2 className="pt-2 text-lg font-bold">Regras de agendamento<HelpTip>Regras que a sua página segue sozinha quando o cliente marca, remarca ou cancela. Escolha uma opção da lista ou &quot;Personalizar&quot; para digitar o valor que quiser.</HelpTip></h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Rule name="min_notice_minutes" label="Antecedência mínima para agendar" value={b.min_notice_minutes} units={["min", "h", "d"]} max={10080}
          help="O tempo mínimo entre o momento em que o cliente marca e o horário do atendimento. Com 1 hora, às 14h ninguém consegue marcar para 14h30, só a partir das 15h. Evita ser pego de surpresa."
          opts={[[0, "Sem mínimo"], [30, "30 minutos"], [60, "1 hora"], [120, "2 horas"], [240, "4 horas"], [1440, "1 dia"]]} />
        <Rule name="max_days_ahead" label="Agenda aberta até" value={b.max_days_ahead} units={["d"]} min={1} max={365} base="d"
          help="Até quantos dias para frente o cliente consegue ver e marcar horários. Com 30 dias, hoje ele vê os horários do próximo mês inteiro, mas não depois disso."
          opts={[[7, "7 dias"], [14, "14 dias"], [30, "30 dias"], [60, "60 dias"], [90, "90 dias"]]} />
        <Rule name="slot_step_minutes" label="Horários de quanto em quanto tempo" value={b.slot_step_minutes} units={["min"]} min={5} max={240} multiple={5}
          help="De quanto em quanto tempo os horários aparecem para o cliente. Com 30 min ele vê 9:00, 9:30, 10:00... A duração do serviço continua a que você cadastrou; isso só define onde cada horário pode começar."
          opts={[[10, "10 min"], [15, "15 min"], [20, "20 min"], [30, "30 min"], [60, "1 hora"]]} />
        <Rule name="cancel_notice_minutes" label="Cliente pode cancelar ou remarcar até" value={b.cancel_notice_minutes} units={["min", "h", "d"]} max={10080}
          help="Até quanto tempo antes do horário o próprio cliente pode cancelar ou remarcar pelo link. Depois desse prazo, o link manda ele falar com você no WhatsApp."
          opts={[[0, "A qualquer momento"], [60, "1 hora antes"], [120, "2 horas antes"], [240, "4 horas antes"], [720, "12 horas antes"], [1440, "1 dia antes"]]} />
      </div>
      <div><label className="label" htmlFor="cancellation_policy">Política de cancelamento (aparece para o cliente)<HelpTip>Um aviso curto que o cliente lê antes de confirmar. Use para combinar regras, como cobrança por falta. É só um aviso: o app não cobra nada sozinho.</HelpTip></label><textarea id="cancellation_policy" name="cancellation_policy" rows={2} defaultValue={b.cancellation_policy ?? ""} className="field" placeholder="Ex.: Cancelamentos com menos de 2h de antecedência podem ser cobrados no próximo atendimento." /></div>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-good">Ajustes salvos.</p>}
      <SubmitButton className="btn btn-primary">Salvar ajustes</SubmitButton>
    </form>
  );
}

type Unit = "min" | "h" | "d";
const UNIT: Record<Unit, { label: string; minutes: number }> = { min: { label: "minutos", minutes: 1 }, h: { label: "horas", minutes: 60 }, d: { label: "dias", minutes: 1440 } };

/** Lista de opções prontas + "Personalizar…" para digitar outro valor. O valor salvo vai num campo oculto. */
function Rule({ name, label, help, value, opts, units, min = 0, max, multiple = 1, base = "min" }: {
  name: string; label: string; help: string; value: number; opts: [number, string][]; units: Unit[]; min?: number; max: number; multiple?: number; base?: "min" | "d";
}) {
  const preset = opts.some(([v]) => v === value);
  const toBase = (u: Unit) => (base === "d" ? 1 : UNIT[u].minutes);
  // Unidade inicial do campo personalizado: a maior que divide o valor certinho
  const startUnit = [...units].reverse().find((u) => value % toBase(u) === 0) ?? units[0];
  const [custom, setCustom] = useState(!preset);
  const [choice, setChoice] = useState(preset ? value : opts[0][0]);
  const [unit, setUnit] = useState<Unit>(startUnit);
  const [amount, setAmount] = useState(String(value / toBase(startUnit)));
  const typed = Math.round(Number(amount.replace(",", ".")) * toBase(unit));
  const bad = custom && (!Number.isFinite(typed) || typed < min || typed > max || typed % multiple !== 0);
  const limit = base === "d" ? `de ${min} a ${max} dias` : max >= 1440 ? `até ${max / 1440} dias` : `de ${min} a ${max} minutos${multiple > 1 ? `, de ${multiple} em ${multiple}` : ""}`;

  return (
    <div>
      <label className="label" htmlFor={name}>{label}<HelpTip>{help}</HelpTip></label>
      <input type="hidden" name={name} value={custom ? (bad ? "invalido" : typed) : choice} />
      <select id={name} className="field" value={custom ? "custom" : choice}
        onChange={(e) => { if (e.target.value === "custom") setCustom(true); else { setCustom(false); setChoice(Number(e.target.value)); } }}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        <option value="custom">Personalizar…</option>
      </select>
      {custom && (
        <div className="mt-2 flex gap-2">
          <input aria-label={`${label}: valor`} inputMode="decimal" className="field w-28" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {units.length > 1
            ? <select aria-label={`${label}: unidade`} className="field" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>{units.map((u) => <option key={u} value={u}>{UNIT[u].label}</option>)}</select>
            : <span className="self-center text-sm text-muted">{UNIT[units[0]].label}</span>}
        </div>
      )}
      {bad && <p className="mt-1 text-xs text-bad">Use um valor {limit}.</p>}
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
