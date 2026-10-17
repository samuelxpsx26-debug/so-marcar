import type { Metadata } from "next";
import { getContext } from "@/lib/business";
import { brl, daysUntil, formatDate, PLAN_PRICE_CENTS, BILLING_NOTICE_DAY, TRIAL_DAYS } from "@/lib/format";
import { SettingsForm, CancelButton } from "./settings-client";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  const { supabase, business, role } = await getContext();
  const { data: sub } = await supabase.from("subscriptions").select("status, trial_ends_at, current_period_end, cancel_at_period_end").eq("business_id", business.id).maybeSingle();
  const tz = business.timezone;
  const daysLeft = daysUntil(sub?.trial_ends_at);
  const noticeDate = sub?.trial_ends_at ? new Date(new Date(sub.trial_ends_at).getTime() - (TRIAL_DAYS - BILLING_NOTICE_DAY) * 86_400_000) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted">Dados do negócio, regras de agendamento e assinatura.</p>
      </div>
      <SettingsForm business={business} />

      <section id="assinatura" className="card space-y-3">
        <h2 className="text-lg font-bold">Assinatura</h2>
        {sub?.status === "trialing" && (
          <>
            <p><span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">Teste grátis</span> <span className="ml-1">faltam <strong>{daysLeft} dias</strong> (até {formatDate(sub.trial_ends_at!, tz, { day: "numeric", month: "long" })})</span></p>
            <p className="text-sm text-muted">No dia {noticeDate ? formatDate(noticeDate, tz, { day: "numeric", month: "long" }) : BILLING_NOTICE_DAY} você recebe o aviso da primeira cobrança de {brl(PLAN_PRICE_CENTS)}/mês. Nada é cobrado antes disso.</p>
          </>
        )}
        {sub?.status === "active" && <p><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-good">Ativa</span> {brl(PLAN_PRICE_CENTS)}/mês{sub.current_period_end ? ` · renova em ${formatDate(sub.current_period_end, tz, { day: "numeric", month: "long" })}` : ""}</p>}
        {sub?.status === "past_due" && <p className="text-bad">Pagamento pendente. Regularize para não pausar sua agenda.</p>}
        {sub?.status === "canceled" && <p>Assinatura cancelada. Sua agenda funciona até {sub.current_period_end ? formatDate(sub.current_period_end, tz, { day: "numeric", month: "long" }) : "o fim do período"}.</p>}
        {sub?.status === "expired" && <p className="text-bad">Seu acesso expirou. Seus dados ficam guardados para quando quiser voltar.</p>}
        {role === "owner" && sub && sub.status !== "canceled" && sub.status !== "expired" && <CancelButton />}
        <p className="text-xs text-muted">Sem fidelidade e sem multa. Você cancela aqui mesmo, a qualquer momento.</p>
      </section>
    </div>
  );
}
