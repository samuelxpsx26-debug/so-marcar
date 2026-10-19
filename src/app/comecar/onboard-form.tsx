"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { SEGMENT_OPTIONS, type Segment } from "@/lib/segments";
import { slugify } from "@/lib/slug";
import { createBusiness, type OnboardState } from "./actions";

export function OnboardForm({ host, defaultSegment }: { host: string; defaultSegment: Segment }) {
  const [state, action] = useActionState<OnboardState, FormData>(createBusiness, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const shownSlug = touched ? slug : slugify(name);

  return (
    <form action={action} className="mt-8 space-y-8">
      <fieldset className="card space-y-4">
        <legend className="px-1 text-sm font-semibold text-brand">1. Seu negócio</legend>
        <div><label className="label" htmlFor="name">Nome</label><input id="name" name="name" className="field" placeholder="Ex.: Barbearia do Zé" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div>
          <label className="label" htmlFor="segment">Ramo</label>
          <select id="segment" name="segment" className="field" defaultValue={defaultSegment}>
            {SEGMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="slug">Seu link</label>
          <div className="flex items-center overflow-hidden rounded-xl border border-line bg-zinc-50 focus-within:border-brand">
            <span className="shrink-0 pl-3.5 text-sm text-muted">{host}/</span>
            <input id="slug" name="slug" className="w-full bg-transparent py-3 pr-3 text-base outline-none" value={shownSlug} onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)); }} required />
          </div>
        </div>
        <div><label className="label" htmlFor="whatsapp">WhatsApp do negócio</label><input id="whatsapp" name="whatsapp" inputMode="tel" className="field" placeholder="(11) 99999-9999" required /></div>
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="px-1 text-sm font-semibold text-brand">2. Seu serviço principal</legend>
        <div><label className="label" htmlFor="serviceName">Serviço</label><input id="serviceName" name="serviceName" className="field" placeholder="Ex.: Corte masculino" required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="duration">Duração (min)</label><input id="duration" name="duration" type="number" min={5} step={5} defaultValue={30} className="field" required /></div>
          <div><label className="label" htmlFor="price">Preço (R$)</label><input id="price" name="price" inputMode="decimal" placeholder="40,00" className="field" /></div>
        </div>
      </fieldset>

      <p className="text-sm text-muted">3. Horário inicial: seg a sex das 9h às 18h, com almoço das 12h às 13h, e sábado das 9h às 13h. Você ajusta em Equipe.</p>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-bad">{state.error}</p>}
      <SubmitButton pendingText="Criando sua agenda…">Criar minha agenda</SubmitButton>
    </form>
  );
}
