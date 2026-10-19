"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify-client";
import { brl, formatDate, formatTime, waLink } from "@/lib/format";
import { SlotPicker } from "@/components/booking/slot-picker";
import type { ResolvedTheme } from "@/components/booking/types";
import { PixPayment, type DepositInfo } from "@/components/booking/pix-payment";

export type BookingInfo = {
  id: string; status: string; starts_at: string; ends_at: string; customer_name: string; can_change: boolean;
  deposit?: DepositInfo;
  service: { id: string; name: string; duration_minutes: number; price_cents: number };
  professional: { id: string; name: string };
  business: { name: string; slug: string; timezone: string; theme: { primary?: string; background?: string }; whatsapp: string | null; cancel_notice_minutes: number; cancellation_policy: string | null };
};

const statusText: Record<string, string> = { confirmed: "Confirmado", pending: "Aguardando confirmação", cancelled: "Cancelado", completed: "Concluído", no_show: "Não compareceu" };

export function ManageBooking({ token, info, theme }: { token: string; info: BookingInfo; theme: ResolvedTheme }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "move">("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tz = info.business.timezone;
  const soft = theme.surface;
  const primary = { background: theme.primary, color: theme.onPrimary };
  const dep = info.deposit;
  const expired = dep?.status === "expired" && info.status === "pending";
  const label = expired ? "Sinal não pago a tempo" : info.status === "pending" && dep?.status === "awaiting" ? "Aguardando o sinal" : statusText[info.status];

  async function cancel() {
    if (!confirm("Cancelar seu horário?")) return;
    setBusy(true);
    const { error } = await createClient().rpc("cancel_booking_by_token", { p_token: token, p_reason: "cancelado pelo cliente" });
    setBusy(false);
    if (error) setError(error.message); else router.refresh();
  }

  async function move(startsAt: string, pro: string) {
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("reschedule_booking_by_token", { p_token: token, p_starts_at: startsAt, p_professional: pro });
    setBusy(false);
    if (error) return setError(error.message);
    const next = (data as { manage_token: string }).manage_token;
    notify(next);
    router.replace(`/reserva/${next}`);
  }

  return (
    <div>
      <p className="text-sm opacity-70">{info.business.name}</p>
      <h1 className="mt-1 text-2xl font-bold">Olá, {info.customer_name.split(" ")[0]}!</h1>
      <div className="mt-5 rounded-2xl p-5" style={{ background: soft }}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
        <p className="mt-1 text-lg font-semibold">{formatDate(info.starts_at, tz)} às {formatTime(info.starts_at, tz)}</p>
        <p className="opacity-80">{info.service.name} com {info.professional.name} · {brl(info.service.price_cents)}</p>
        {dep && (dep.status === "paid" || dep.status === "waived") && dep.cents > 0 && (
          <p className="mt-2 text-sm font-medium">{dep.status === "paid" ? `Sinal de ${brl(dep.cents)} pago ✓ · falta ${brl(Math.max(info.service.price_cents - dep.cents, 0))} no dia` : "Sinal dispensado pelo estabelecimento"}</p>
        )}
      </div>

      {info.status === "pending" && dep?.status === "awaiting" && dep.pix && (
        <div className="mt-5">
          <PixPayment deposit={dep} bookingId={info.id} theme={theme} timezone={tz} businessName={info.business.name} whatsapp={info.business.whatsapp}
            waText={`Oi! Sou ${info.customer_name} e paguei o sinal de ${brl(dep.cents)} para ${info.service.name} em ${formatDate(info.starts_at, tz, { day: "numeric", month: "numeric" })} às ${formatTime(info.starts_at, tz)}.`} />
        </div>
      )}
      {expired && (
        <p className="mt-5 rounded-2xl p-4 text-sm" style={{ background: soft }}>O prazo para pagar o sinal acabou e o horário foi liberado. Se você já pagou, {info.business.whatsapp ? <a className="underline" href={waLink(info.business.whatsapp, `Oi! Sou ${info.customer_name} e paguei o sinal de ${brl(dep!.cents)} para ${formatDate(info.starts_at, tz, { day: "numeric", month: "numeric" })} às ${formatTime(info.starts_at, tz)}.`)}>fale com {info.business.name}</a> : `fale com ${info.business.name}`}. Se não, é só marcar de novo.</p>
      )}

      {info.can_change && mode === "view" && (
        <div className="mt-5 space-y-2">
          <button onClick={() => setMode("move")} className="w-full rounded-2xl py-4 font-bold" style={primary}>Remarcar</button>
          <button disabled={busy} onClick={cancel} className="w-full rounded-2xl py-3 text-sm opacity-80" style={{ border: `1px solid ${theme.text}33` }}>Cancelar horário</button>
        </div>
      )}
      {info.can_change && mode === "move" && (
        <div className="mt-6">
          <button onClick={() => setMode("view")} className="mb-3 text-sm opacity-75">← Voltar</button>
          <h2 className="mb-3 text-lg font-semibold">Escolha o novo horário</h2>
          <SlotPicker slug={info.business.slug} serviceId={info.service.id} professionalId={info.professional.id} timezone={tz} maxDays={60} theme={theme}
            onPick={(s) => !busy && move(s.starts_at, s.professional_id)} />
        </div>
      )}
      {!info.can_change && !expired && (info.status === "confirmed" || info.status === "pending") && (
        <p className="mt-5 text-sm opacity-80">O prazo para remarcar pelo link já passou.{info.business.whatsapp && <> <a className="underline" href={waLink(info.business.whatsapp, `Oi! Preciso falar sobre meu horário de ${formatTime(info.starts_at, tz)}.`)}>Fale com {info.business.name}</a>.</>}</p>
      )}
      {(info.status === "cancelled" || expired) && (
        <Link href={`/${info.business.slug}`} className="mt-5 block rounded-2xl py-4 text-center font-bold" style={primary}>Agendar outro horário</Link>
      )}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/15 p-3 text-sm">{error}</p>}
      {info.business.cancellation_policy && <p className="mt-6 text-xs opacity-60">{info.business.cancellation_policy}</p>}
    </div>
  );
}
