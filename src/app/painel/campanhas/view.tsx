"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { brl, formatDate, waLink } from "@/lib/format";
import { DEFAULT_CAMPAIGN_MESSAGE, fillMessage, type Lapsed } from "@/lib/campaign";
import { HelpTip } from "@/components/help-tip";
import { Coupons, couponLabel, type Coupon } from "./coupons";

// Mensagem e "já enviei" ficam no aparelho do dono: é só um lembrete de quem já foi chamado
const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };

export function CampaignView({ businessId, businessName, bookingUrl, days, options, list, coupons, couponsReady }: {
  businessId: string; businessName: string; bookingUrl: string; days: number; options: number[]; list: Lapsed[]; coupons: Coupon[]; couponsReady: boolean;
}) {
  const msgKey = `somarcar:campanha-msg:${businessId}`;
  const sentKey = `somarcar:campanha-enviados:${businessId}`;
  const [message, setMessage] = useState(DEFAULT_CAMPAIGN_MESSAGE);
  const [sent, setSent] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o aparelho só depois de montar, para não divergir do HTML do servidor
  useEffect(() => { setMessage(read(msgKey, DEFAULT_CAMPAIGN_MESSAGE)); setSent(read(sentKey, {})); }, [msgKey, sentKey]);

  const hidden = list.filter((c) => !c.consent).length;
  const shown = useMemo(() => {
    const base = showAll ? list : list.filter((c) => c.consent);
    // Quem ainda não foi chamado vem primeiro
    return [...base].sort((a, b) => Number(!!sent[a.id]) - Number(!!sent[b.id]));
  }, [list, showAll, sent]);
  const pending = shown.filter((c) => !sent[c.id]).length;
  const potential = shown.reduce((s, c) => s + Math.round(c.spentCents / c.visits), 0);

  function couponToMessage(k: Coupon) {
    const text = `Oi, {nome}! Sentimos sua falta aqui no {negocio}. Para você voltar, preparamos ${couponLabel(k)} com o cupom ${k.code}. É só marcar por este link que ele já vem aplicado: ${bookingUrl}?cupom=${k.code}`;
    setMessage(text);
    write(msgKey, text);
    document.getElementById("msg")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function markSent(id: string) {
    const next = { ...sent, [id]: new Date().toISOString() };
    setSent(next);
    write(sentKey, next);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campanha: quem não volta<HelpTip>Clientes que já vieram, estão sem aparecer há algum tempo e não têm horário marcado. Toque em &quot;Chamar&quot; para abrir o WhatsApp com a mensagem pronta. Quem marcar pelo link sai da lista sozinho.</HelpTip></h1>
        <p className="text-sm text-muted">{shown.length} {shown.length === 1 ? "cliente" : "clientes"} sem vir há {days} dias ou mais · se cada um voltar uma vez, são cerca de <strong className="text-ink">{brl(potential)}</strong></p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Sem vir há</span>
        {options.map((d) => (
          <Link key={d} href={`/painel/campanhas?d=${d}`} className={`rounded-full px-3 py-1.5 font-medium ${d === days ? "bg-brand text-brand-ink" : "border border-line bg-surface text-muted"}`}>{d} dias</Link>
        ))}
      </div>

      <Coupons list={coupons} ready={couponsReady} bookingUrl={bookingUrl} onUse={couponToMessage} />

      <section className="card space-y-2">
        <label htmlFor="msg" className="label">Mensagem</label>
        <textarea id="msg" rows={3} value={message} onChange={(e) => { setMessage(e.target.value); write(msgKey, e.target.value); }} className="field" />
        <p className="text-xs text-muted">Use {"{nome}"} para o primeiro nome do cliente, {"{negocio}"} para o nome do seu negócio e {"{link}"} para o link de agendamento. Dica: crie um cupom acima e toque em &quot;Usar na campanha&quot; para a mensagem já levar o desconto.
          {message !== DEFAULT_CAMPAIGN_MESSAGE && <> <button type="button" className="underline" onClick={() => { setMessage(DEFAULT_CAMPAIGN_MESSAGE); write(msgKey, DEFAULT_CAMPAIGN_MESSAGE); }}>Voltar à mensagem padrão</button></>}
        </p>
      </section>

      {hidden > 0 && (
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="mt-0.5" />
          Mostrar também {hidden} {hidden === 1 ? "cliente que não autorizou" : "clientes que não autorizaram"} receber avisos ao marcar
        </label>
      )}

      {shown.length === 0 ? (
        <div className="card text-sm text-muted">Ninguém sumido há {days} dias ou mais. Seus clientes estão voltando! 🎉</div>
      ) : (
        <section className="rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          <p className="border-b border-line px-4 py-3 text-sm text-muted">{pending === 0 ? "Você já chamou todo mundo desta lista." : `${pending === 1 ? "Falta 1" : `Faltam ${pending}`} para chamar.`}</p>
          <div className="divide-y divide-line">
            {shown.map((c) => {
              const when = sent[c.id];
              return (
                <div key={c.id} className={`flex items-center gap-3 px-4 py-3 text-sm ${when ? "opacity-60" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block text-xs text-muted">{c.daysSince} dias sem vir · {c.visits} {c.visits === 1 ? "visita" : "visitas"} · {brl(c.spentCents)}{when ? ` · chamado ${formatDate(when, Intl.DateTimeFormat().resolvedOptions().timeZone, { day: "numeric", month: "short" })}` : ""}</span>
                  </span>
                  <a target="_blank" onClick={() => markSent(c.id)} href={waLink(c.phone, fillMessage(message, { name: c.name, business: businessName, link: bookingUrl, days: c.daysSince }))} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${when ? "border border-line text-muted" : "bg-[#25D366] text-white"}`}>{when ? "Chamar de novo" : "Chamar"}</a>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
