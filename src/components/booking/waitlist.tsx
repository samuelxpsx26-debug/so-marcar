"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, normalizePhone } from "@/lib/format";
import { Input } from "./input";
import type { PublicBusiness, PublicService, ResolvedTheme } from "./types";

const PERIODS = [["qualquer", "Qualquer horário"], ["manha", "Manhã"], ["tarde", "Tarde"], ["noite", "Noite"]] as const;

/** Lista de espera de um dia lotado: o cliente deixa nome e WhatsApp e o dono chama quando abrir vaga */
export function Waitlist({ b, theme, service, professionalId, day }: { b: PublicBusiness; theme: ResolvedTheme; service: PublicService; professionalId: string | null; day: string }) {
  const [form, setForm] = useState({ name: "", phone: "", consent: true });
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>("qualquer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const dateLabel = formatDate(`${day}T12:00:00Z`, "UTC").toLowerCase();
  const soft = theme.surface;

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError("Informe seu nome");
    if (!/^\d{12,13}$/.test(normalizePhone(form.phone))) return setError("Informe seu WhatsApp com DDD");
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("join_waitlist", {
      p_slug: b.slug, p_service: service.id, p_date: day, p_name: form.name, p_phone: form.phone,
      p_period: period, p_professional: professionalId, p_marketing_consent: form.consent,
    });
    setBusy(false);
    // Mensagens do banco (22023, P0002, 54000) já vêm em português; o resto vira uma mensagem amigável
    if (error) return setError(["22023", "P0002", "54000"].includes(error.code) ? error.message : "Não foi possível entrar na lista agora. Tente de novo ou fale com o estabelecimento.");
    setPosition((data as { position: number }).position);
  }

  if (position !== null) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl" style={{ background: theme.primary, color: theme.onPrimary }}>✓</div>
        <h2 className="text-xl font-bold">Você está na lista de espera!</h2>
        <p className="opacity-80">{position === 1 ? "Você é o primeiro da fila" : `Você é o ${position}º da fila`} para {service.name} em {dateLabel}.</p>
        <p className="rounded-2xl p-4 text-sm" style={{ background: soft }}>Se alguém desmarcar, {b.name} te chama no WhatsApp. Enquanto isso, você pode marcar em outro dia se preferir.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">Lista de espera</h2>
      <p className="mb-4 text-sm opacity-80">{service.name} · {dateLabel}</p>
      <form onSubmit={join} className="space-y-3">
        <div>
          <span className="mb-1 block text-sm font-medium">Qual horário serve para você?</span>
          <div className="grid grid-cols-2 gap-2">
            {PERIODS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)} className="rounded-xl py-2.5 text-sm font-semibold"
                style={period === id ? { background: theme.primary, color: theme.onPrimary, border: `1px solid ${theme.primary}` } : { background: soft, border: `1px solid ${theme.text}33` }}>{label}</button>
            ))}
          </div>
        </div>
        <Input label="Seu nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" theme={theme} />
        <Input label="WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" theme={theme} />
        <label className="flex items-start gap-2 text-sm opacity-80">
          <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-0.5" style={{ accentColor: theme.primary }} />
          Quero receber avisos de horários livres de {b.name}.
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-500/15 p-3 text-sm">{error}</p>}
        <button disabled={busy} className="w-full rounded-2xl py-4 text-base font-bold transition active:scale-[.99] disabled:opacity-60" style={{ background: theme.primary, color: theme.onPrimary }}>
          {busy ? "Entrando…" : "Entrar na lista de espera"}
        </button>
      </form>
    </div>
  );
}
