"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brl, formatDate, formatTime, normalizePhone, waLink } from "@/lib/format";
import { SlotPicker } from "./slot-picker";
import type { PublicBusiness, ResolvedTheme, Slot } from "./types";

type Step = "service" | "pro" | "time" | "details" | "done";

export function BookingFlow({ b, theme }: { b: PublicBusiness; theme: ResolvedTheme }) {
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [proId, setProId] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", consent: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ manage_token: string; starts_at: string } | null>(null);
  const idem = useMemo(() => crypto.randomUUID(), []);

  const service = b.services.find((s) => s.id === serviceId);
  const pros = b.professionals.filter((p) => !serviceId || p.service_ids.length === 0 || p.service_ids.includes(serviceId));
  const proName = slot?.professional_name ?? b.professionals.find((p) => p.id === proId)?.name;
  const soft = theme.text === "#ffffff" ? "#ffffff14" : "#0000000a";
  const tz = b.timezone;

  function pickService(id: string) {
    setServiceId(id);
    setSlot(null);
    const eligible = b.professionals.filter((p) => p.service_ids.length === 0 || p.service_ids.includes(id));
    if (eligible.length <= 1) { setProId(eligible[0]?.id ?? null); setStep("time"); } else setStep("pro");
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!slot || !serviceId) return;
    if (form.name.trim().length < 2) return setError("Informe seu nome");
    if (!/^\d{12,13}$/.test(normalizePhone(form.phone))) return setError("Informe seu WhatsApp com DDD");
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("create_public_booking", {
      p_slug: b.slug, p_service: serviceId, p_professional: slot.professional_id, p_starts_at: slot.starts_at,
      p_name: form.name, p_phone: form.phone, p_email: form.email || null, p_idempotency_key: idem, p_marketing_consent: form.consent,
    });
    setBusy(false);
    if (error) {
      setError(error.message || "Não foi possível agendar. Tente outro horário.");
      if (error.code === "23P01") { setSlot(null); setStep("time"); }
      return;
    }
    setResult(data as { manage_token: string; starts_at: string });
    setStep("done");
  }

  const back = (to: Step) => <button type="button" onClick={() => { setError(null); setStep(to); }} className="mb-3 text-sm opacity-75">← Voltar</button>;
  const primaryBtn = { background: theme.primary, color: theme.onPrimary };

  if (!b.active) {
    return <div className="rounded-2xl p-5 text-center" style={{ background: soft }}>A agenda online está pausada no momento. {b.whatsapp && <a className="underline" href={waLink(b.whatsapp, "Oi! Quero agendar um horário.")}>Fale pelo WhatsApp</a>}</div>;
  }

  return (
    <div>
      {step === "service" && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Escolha o serviço</h2>
          <div className="space-y-2">
            {b.services.length === 0 && <p className="opacity-75">Nenhum serviço disponível ainda.</p>}
            {b.services.map((s) => (
              <button key={s.id} onClick={() => pickService(s.id)} className="flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition active:scale-[.99]" style={{ background: soft }}>
                <span className="min-w-0">
                  <span className="block font-semibold">{s.name}</span>
                  <span className="block text-sm opacity-70">{s.duration_minutes} min{s.description ? ` · ${s.description}` : ""}</span>
                </span>
                <span className="shrink-0 font-bold">{s.price_cents ? brl(s.price_cents) : "Consultar"}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "pro" && (
        <section>
          {back("service")}
          <h2 className="mb-3 text-lg font-semibold">Com quem?</h2>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setProId(null); setStep("time"); }} className="rounded-2xl p-4 text-left" style={{ background: soft }}>
              <span className="block font-semibold">Qualquer um</span><span className="text-sm opacity-70">primeiro horário livre</span>
            </button>
            {pros.map((p) => (
              <button key={p.id} onClick={() => { setProId(p.id); setStep("time"); }} className="rounded-2xl p-4 text-left" style={{ background: soft }}>
                <span className="mb-2 grid h-10 w-10 place-items-center rounded-full font-bold" style={primaryBtn}>{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="block truncate font-semibold">{p.name}</span>
                {p.bio && <span className="block truncate text-sm opacity-70">{p.bio}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "time" && serviceId && (
        <section>
          {back(pros.length > 1 ? "pro" : "service")}
          <h2 className="mb-3 text-lg font-semibold">Escolha o horário</h2>
          <SlotPicker slug={b.slug} serviceId={serviceId} professionalId={proId} timezone={tz} maxDays={b.max_days_ahead} theme={theme} selected={slot}
            onPick={(s) => { setSlot(s); setStep("details"); }} />
        </section>
      )}

      {step === "details" && slot && service && (
        <section>
          {back("time")}
          <div className="mb-4 rounded-2xl p-4" style={{ background: soft }}>
            <p className="font-semibold">{service.name}</p>
            <p className="text-sm opacity-80">{formatDate(slot.starts_at, tz)} às {formatTime(slot.starts_at, tz)}</p>
            <p className="text-sm opacity-80">com {proName} · {service.price_cents ? brl(service.price_cents) : "valor a combinar"}</p>
          </div>
          <form onSubmit={confirm} className="space-y-3">
            <Input label="Seu nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" theme={theme} />
            <Input label="WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" theme={theme} />
            <Input label="E-mail (para receber o lembrete)" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" autoComplete="email" theme={theme} optional />
            <label className="flex items-start gap-2 text-sm opacity-80">
              <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-0.5" style={{ accentColor: theme.primary }} />
              Quero receber lembretes e avisos de horários livres de {b.name}.
            </label>
            {error && <p role="alert" className="rounded-xl bg-red-500/15 p-3 text-sm">{error}</p>}
            <button disabled={busy} className="w-full rounded-2xl py-4 text-base font-bold transition active:scale-[.99] disabled:opacity-60" style={primaryBtn}>
              {busy ? "Agendando…" : "Confirmar agendamento"}
            </button>
            {b.cancellation_policy && <p className="text-xs opacity-60">{b.cancellation_policy}</p>}
          </form>
        </section>
      )}

      {step === "done" && result && slot && service && (
        <Done b={b} theme={theme} service={service.name} proName={proName ?? ""} startsAt={result.starts_at} token={result.manage_token} customer={form.name} durationMin={service.duration_minutes} />
      )}
    </div>
  );
}

function Input({ label, value, onChange, theme, optional, ...rest }: { label: string; value: string; onChange: (v: string) => void; theme: ResolvedTheme; optional?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}{optional && <span className="opacity-60"> (opcional)</span>}</span>
      <input {...rest} required={!optional} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-transparent px-3.5 py-3 text-base outline-none" style={{ border: `1px solid ${theme.text}33`, color: theme.text }} />
    </label>
  );
}

function Done({ b, theme, service, proName, startsAt, token, customer, durationMin }: { b: PublicBusiness; theme: ResolvedTheme; service: string; proName: string; startsAt: string; token: string; customer: string; durationMin: number }) {
  const tz = b.timezone;
  const manageUrl = `${window.location.origin}/reserva/${token}`;
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMin * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${service} · ${b.name}`)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(`Gerenciar: ${manageUrl}`)}${b.address?.text ? `&location=${encodeURIComponent(b.address.text)}` : ""}`;
  const soft = theme.text === "#ffffff" ? "#ffffff14" : "#0000000a";

  return (
    <section className="text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl" style={{ background: theme.primary, color: theme.onPrimary }}>✓</div>
      <h2 className="mt-4 text-2xl font-bold">Agendado!</h2>
      <p className="mt-2 opacity-80">{formatDate(startsAt, tz)} às {formatTime(startsAt, tz)}</p>
      <p className="opacity-80">{service} com {proName}</p>
      <div className="mt-6 space-y-2 text-left">
        <a href={gcal} target="_blank" className="block rounded-2xl p-4 font-medium" style={{ background: soft }}>📅 Adicionar à minha agenda</a>
        {b.whatsapp && (
          <a href={waLink(b.whatsapp, `Oi! Sou ${customer} e acabei de agendar ${service} para ${formatDate(startsAt, tz, { day: "numeric", month: "numeric" })} às ${formatTime(startsAt, tz)}.`)} target="_blank" className="block rounded-2xl p-4 font-medium" style={{ background: soft }}>
            💬 Avisar {b.name} no WhatsApp
          </a>
        )}
        <a href={manageUrl} className="block rounded-2xl p-4 font-medium" style={{ background: soft }}>🔁 Remarcar ou cancelar</a>
      </div>
      <p className="mt-4 text-xs opacity-60">Guarde este link para remarcar quando precisar.</p>
    </section>
  );
}
