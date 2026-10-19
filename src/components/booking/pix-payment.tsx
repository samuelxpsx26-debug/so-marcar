"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { brl, formatDate, formatTime, waLink } from "@/lib/format";
import { pixPayload } from "@/lib/pix";
import type { ResolvedTheme } from "./types";

export type DepositInfo = {
  cents: number; status: "none" | "awaiting" | "paid" | "waived" | "expired"; due_at: string | null;
  pix: { key: string; type: string; holder: string; city: string } | null;
};

/** QR Code + Pix copia e cola do sinal, com prazo e botão para avisar o dono */
export function PixPayment({ deposit, bookingId, theme, timezone, businessName, whatsapp, waText }: {
  deposit: DepositInfo; bookingId: string; theme: ResolvedTheme; timezone: string; businessName: string; whatsapp: string | null; waText: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pix = deposit.pix;
  const code = pix ? pixPayload({ key: pix.key, name: pix.holder, city: pix.city, amountCents: deposit.cents, txid: `SM${bookingId.replace(/-/g, "").slice(0, 12)}` }) : null;

  useEffect(() => {
    if (!code) return;
    QRCode.toDataURL(code, { margin: 1, width: 480, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(null));
  }, [code]);

  if (!pix || !code) return null;

  async function copy() {
    try { await navigator.clipboard.writeText(code!); } catch {
      const t = document.getElementById("pix-code") as HTMLTextAreaElement | null;
      t?.select(); document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const due = deposit.due_at ? new Date(deposit.due_at) : null;
  const sameDay = due && formatDate(due, timezone, { day: "numeric", month: "numeric" }) === formatDate(new Date(), timezone, { day: "numeric", month: "numeric" });

  return (
    <div className="rounded-2xl p-5 text-center" style={{ background: theme.surface, border: `1px solid ${theme.primary}66` }}>
      <p className="text-sm font-semibold uppercase tracking-wide opacity-80">Falta só o sinal</p>
      <p className="mt-1 text-4xl font-extrabold">{brl(deposit.cents)}</p>
      {due && <p className="mt-1 text-sm opacity-80">Pague até <strong>{sameDay ? "" : `${formatDate(due, timezone, { day: "numeric", month: "numeric" })} às `}{formatTime(due, timezone)}</strong> para garantir. Depois disso o horário é liberado.</p>}
      <div className="mx-auto mt-4 w-52 rounded-2xl bg-white p-3" style={{ textShadow: "none" }}>
        {qr ? <img src={qr} alt="QR Code do Pix" className="h-full w-full" /> : <div className="aspect-square animate-pulse rounded-xl bg-zinc-200" />}
      </div>
      <p className="mt-3 text-sm opacity-80">Pix para <strong>{pix.holder}</strong></p>
      <textarea id="pix-code" readOnly value={code} rows={3} onFocus={(e) => e.target.select()}
        className="mt-3 w-full resize-none rounded-xl p-3 font-mono text-[11px] leading-snug" style={{ background: "rgba(0,0,0,.25)", color: theme.text, border: `1px solid ${theme.text}26`, textShadow: "none" }} />
      <button type="button" onClick={copy} className="mt-2 w-full rounded-2xl py-4 text-base font-bold transition active:scale-[.99]" style={{ background: theme.primary, color: theme.onPrimary }}>
        {copied ? "Código copiado ✓" : "Copiar código Pix"}
      </button>
      <p className="mt-2 text-xs opacity-70">No app do seu banco, escolha Pix &gt; Pix copia e cola, ou aponte a câmera para o QR Code.</p>
      {whatsapp && (
        <a href={waLink(whatsapp, waText)} target="_blank" className="mt-4 block rounded-2xl py-3 text-sm font-semibold" style={{ border: `1px solid ${theme.text}33` }}>
          Já paguei: avisar {businessName} no WhatsApp
        </a>
      )}
      <p className="mt-3 text-xs opacity-60">O dinheiro vai direto para {businessName}. Seu horário fica confirmado assim que o pagamento for conferido.</p>
    </div>
  );
}
