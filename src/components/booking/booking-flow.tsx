"use client";
import { useEffect, useMemo, useState } from "react";
import { forgetCustomer, loadCustomer, saveCustomer } from "@/lib/remembered-customer";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify-client";
import { brl, formatDate, formatTime, normalizePhone, waLink } from "@/lib/format";
import { SlotPicker } from "./slot-picker";
import { Waitlist } from "./waitlist";
import { Input } from "./input";
import { PixPayment, type DepositInfo } from "./pix-payment";
import { depositCents } from "@/lib/pix";
import type { PublicBusiness, ResolvedTheme, Slot } from "./types";

type Booked = { id: string; manage_token: string; starts_at: string; deposit_cents?: number; deposit_status?: string };
type Step = "service" | "pro" | "time" | "details" | "done" | "waitlist";

export function BookingFlow({ b, theme }: { b: PublicBusiness; theme: ResolvedTheme }) {
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [proId, setProId] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  // O formulário só aparece depois de escolher o horário, então ler o aparelho aqui não afeta a hidratação
  const [form, setForm] = useState(() => {
    const c = typeof window === "undefined" ? null : loadCustomer();
    return { name: c?.name ?? "", phone: c?.phone ?? "", email: c?.email ?? "", consent: true };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Booked | null>(null);
  const [waitDay, setWaitDay] = useState<string | null>(null);
  const idem = useMemo(() => crypto.randomUUID(), []);
  const [remembered, setRemembered] = useState(() => form.phone !== "");
  // Cupom: pode vir no link (?cupom=VOLTA10, usado nas campanhas) ou ser digitado
  const [couponInput, setCouponInput] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("cupom") ?? "").toUpperCase());
  const [couponOpen, setCouponOpen] = useState(() => couponInput !== "");
  const [coupon, setCoupon] = useState<{ code: string; serviceId: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  const service = b.services.find((s) => s.id === serviceId);
  const pros = b.professionals.filter((p) => !serviceId || p.service_ids.length === 0 || p.service_ids.includes(serviceId));
  const proName = slot?.professional_name ?? b.professionals.find((p) => p.id === proId)?.name;
  const soft = theme.surface;
  const tz = b.timezone;
  const discount = coupon && coupon.serviceId === serviceId ? coupon.discount : 0;
  const price = service ? service.price_cents - discount : 0;
  const deposit = service && b.deposit ? depositCents(b.deposit.mode, b.deposit.value, price) : 0;

  async function applyCoupon(code = couponInput, sid = serviceId) {
    const clean = code.trim().toUpperCase();
    if (!clean || !sid) return;
    setCouponMsg(null);
    const { data, error } = await createClient().rpc("check_coupon", { p_slug: b.slug, p_code: clean, p_service: sid, p_phone: form.phone || null });
    if (error) { setCoupon(null); setCouponMsg(error.code === "22023" ? error.message : "Não foi possível conferir o cupom agora."); return; }
    const r = data as { code: string; discount_cents: number };
    setCoupon({ code: r.code, serviceId: sid, discount: r.discount_cents });
  }

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
      p_coupon: discount > 0 ? coupon!.code : null,
    });
    setBusy(false);
    if (error) {
      setError(error.message || "Não foi possível agendar. Tente outro horário.");
      if (error.code === "23P01") { setSlot(null); setStep("time"); }
      return;
    }
    saveCustomer(form);
    const booked = data as Booked;
    setResult(booked);
    // Com sinal, a confirmação por e-mail só sai depois que o dono confirmar o Pix
    if (booked.deposit_status !== "awaiting") notify(booked.manage_token);
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
          {b.loyalty && (
            <p className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: `${theme.primary}26` }}>
              🎁 <strong>Cartão fidelidade:</strong> a cada {b.loyalty.visits} atendimentos, você ganha {b.loyalty.reward}.
            </p>
          )}
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
          {!!b.packages?.length && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">Pacotes</h2>
              <div className="space-y-2">
                {b.packages.map((k) => {
                  const single = b.services.find((s) => s.id === k.service_id)?.price_cents ?? 0;
                  const save = single * k.sessions - k.price_cents;
                  return (
                    <div key={k.id} className="flex items-center justify-between gap-3 rounded-2xl p-4" style={{ background: soft }}>
                      <span className="min-w-0">
                        <span className="block font-semibold">{k.name}</span>
                        <span className="block text-sm opacity-70">{k.sessions} sessões{save > 0 ? ` · economize ${brl(save)}` : ""}{k.valid_days ? ` · use em ${k.valid_days} dias` : ""}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-bold">{brl(k.price_cents)}</span>
                        {b.whatsapp && <a href={waLink(b.whatsapp, `Oi! Tenho interesse no pacote "${k.name}" (${brl(k.price_cents)}).`)} target="_blank" className="text-xs underline opacity-80">Quero este</a>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" className="mb-2 h-12 w-12 rounded-full object-cover" />
                  : <span className="mb-2 grid h-10 w-10 place-items-center rounded-full font-bold" style={primaryBtn}>{p.name.slice(0, 1).toUpperCase()}</span>}
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
            onPick={(s) => { setSlot(s); setStep("details"); if (couponInput && coupon?.serviceId !== serviceId) applyCoupon(); }} onWaitlist={(d) => { setWaitDay(d); setStep("waitlist"); }} />
        </section>
      )}

      {step === "waitlist" && service && waitDay && (
        <section>
          {back("time")}
          <Waitlist b={b} theme={theme} service={service} professionalId={proId} day={waitDay} />
        </section>
      )}

      {step === "details" && slot && service && (
        <section>
          {back("time")}
          <div className="mb-4 rounded-2xl p-4" style={{ background: soft }}>
            <p className="font-semibold">{service.name}</p>
            <p className="text-sm opacity-80">{formatDate(slot.starts_at, tz)} às {formatTime(slot.starts_at, tz)}</p>
            <p className="text-sm opacity-80">com {proName} · {service.price_cents ? (discount > 0 ? <><s className="opacity-60">{brl(service.price_cents)}</s> <strong>{brl(price)}</strong></> : brl(service.price_cents)) : "valor a combinar"}</p>
            {discount > 0 && <p className="mt-1 text-sm font-medium">🏷️ Cupom {coupon!.code}: {brl(discount)} de desconto</p>}
            {deposit > 0 && (
              <p className="mt-2 rounded-xl px-3 py-2 text-sm font-medium" style={{ background: `${theme.primary}26` }}>
                Para garantir o horário: sinal de {brl(deposit)} no Pix{deposit < price ? ` e ${brl(price - deposit)} no dia` : ""}.
              </p>
            )}
          </div>
          <form onSubmit={confirm} className="space-y-3">
            {remembered && (
              <p className="text-sm opacity-75">
                Seus dados da última vez já estão preenchidos.{" "}
                <button type="button" className="underline" onClick={() => { forgetCustomer(); setRemembered(false); setForm({ ...form, name: "", phone: "", email: "" }); }}>Não é você?</button>
              </p>
            )}
            <Input label="Seu nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" theme={theme} />
            <Input label="WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" theme={theme} />
            <Input label="E-mail (para receber o lembrete)" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" autoComplete="email" theme={theme} optional />
            <label className="flex items-start gap-2 text-sm opacity-80">
              <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-0.5" style={{ accentColor: theme.primary }} />
              Quero receber lembretes e avisos de horários livres de {b.name}.
            </label>
            {service.price_cents > 0 && (couponOpen ? (
              <div>
                <div className="flex gap-2">
                  <input value={couponInput} onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponMsg(null); setCoupon(null); }} placeholder="Código do cupom" aria-label="Código do cupom"
                    className="min-w-0 flex-1 rounded-2xl border px-4 py-3 uppercase outline-none" style={{ background: soft, borderColor: `${theme.text}33`, color: theme.text }} />
                  <button type="button" onClick={() => applyCoupon()} className="shrink-0 rounded-2xl px-4 text-sm font-semibold" style={{ border: `1px solid ${theme.primary}`, color: theme.text }}>Aplicar</button>
                </div>
                {couponMsg && <p className="mt-1 text-sm text-red-500">{couponMsg}</p>}
              </div>
            ) : <button type="button" onClick={() => setCouponOpen(true)} className="text-sm underline opacity-75">Tenho um cupom de desconto</button>)}
            {error && <p role="alert" className="rounded-xl bg-red-500/15 p-3 text-sm">{error}</p>}
            <button disabled={busy} className="w-full rounded-2xl py-4 text-base font-bold transition active:scale-[.99] disabled:opacity-60" style={primaryBtn}>
              {busy ? "Agendando…" : deposit > 0 ? "Reservar e pagar o sinal" : "Confirmar agendamento"}
            </button>
            {b.cancellation_policy && <p className="text-xs opacity-60">{b.cancellation_policy}</p>}
          </form>
        </section>
      )}

      {step === "done" && result && slot && service && (
        <Done b={b} theme={theme} service={service.name} proName={proName ?? ""} booked={result} customer={form.name} durationMin={service.duration_minutes} />
      )}
    </div>
  );
}

function Done({ b, theme, service, proName, booked, customer, durationMin }: { b: PublicBusiness; theme: ResolvedTheme; service: string; proName: string; booked: Booked; customer: string; durationMin: number }) {
  const { starts_at: startsAt, manage_token: token } = booked;
  const awaiting = booked.deposit_status === "awaiting";
  const [deposit, setDeposit] = useState<DepositInfo | null | undefined>(undefined);
  useEffect(() => {
    if (!awaiting) return;
    createClient().rpc("get_booking_by_token", { p_token: token }).then(({ data }) => setDeposit((data as { deposit?: DepositInfo } | null)?.deposit ?? null));
  }, [awaiting, token]);
  const tz = b.timezone;
  const manageUrl = `${window.location.origin}/reserva/${token}`;
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMin * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const soft = theme.surface;
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${service} · ${b.name}`)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(`Gerenciar: ${manageUrl}`)}${b.address?.text ? `&location=${encodeURIComponent(b.address.text)}` : ""}`;

  return (
    <section className="text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl" style={{ background: theme.primary, color: theme.onPrimary }}>✓</div>
      <h2 className="mt-4 text-2xl font-bold">{awaiting ? "Horário reservado!" : "Agendado!"}</h2>
      <p className="mt-2 opacity-80">{formatDate(startsAt, tz)} às {formatTime(startsAt, tz)}</p>
      <p className="opacity-80">{service} com {proName}</p>
      {awaiting && (
        <div className="mt-6 text-left">
          {deposit === undefined ? <div className="h-96 animate-pulse rounded-2xl" style={{ background: soft }} />
            : deposit?.pix ? <PixPayment deposit={deposit} bookingId={booked.id} theme={theme} timezone={tz} businessName={b.name} whatsapp={b.whatsapp}
                waText={`Oi! Sou ${customer} e paguei o sinal de ${brl(deposit.cents)} para ${service} em ${formatDate(startsAt, tz, { day: "numeric", month: "numeric" })} às ${formatTime(startsAt, tz)}.`} />
            : <p className="rounded-2xl p-4 text-sm" style={{ background: soft }}>Abra o link &quot;Remarcar ou cancelar&quot; abaixo para ver como pagar o sinal.</p>}
        </div>
      )}
      <div className="mt-6 space-y-2 text-left">
        <a href={gcal} target="_blank" className="block rounded-2xl p-4 font-medium" style={{ background: soft }}>📅 Adicionar à minha agenda</a>
        {b.whatsapp && !awaiting && (
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
