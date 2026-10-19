import type { Metadata } from "next";
import { getContext } from "@/lib/business";
import { brl, daysUntil, formatDate, BILLING_NOTICE_DAY } from "@/lib/format";
import { getPlan } from "@/lib/billing/plans";
import { billingConfigured, stripeMode } from "@/lib/billing/stripe";
import { reconcileBusinessSubscription } from "@/lib/billing/sync";
import { createServiceClient } from "@/lib/supabase/server";
import { SettingsForm, CancelButton } from "./settings-client";
import { DepositForm } from "./deposit-form";
import { openBillingPortal, startCheckout } from "./billing-actions";
import { HelpTip } from "@/components/help-tip";

const NOTICES: Record<string, string> = {
  retorno: "Recebemos seu retorno do pagamento. Assim que a Stripe confirmar, sua assinatura aparece como ativa aqui. Atualize a página em instantes.",
  indisponivel: "A cobrança online ainda não está liberada. Nada foi cobrado.",
  "sem-permissao": "Só o dono do negócio pode mexer na assinatura.",
  erro: "Não foi possível abrir o pagamento agora. Tente de novo em instantes.",
};

export const metadata: Metadata = { title: "Ajustes" };

type Sub = {
  status: string; plan: string; price_cents: number; trial_ends_at: string | null; current_period_end: string | null;
  cancel_at_period_end: boolean; provider: string | null; provider_subscription_id: string | null; last_payment_error?: string | null;
};

export default async function AjustesPage({ searchParams }: { searchParams: Promise<{ assinatura?: string }> }) {
  const { supabase, business, role } = await getContext();
  const { assinatura } = await searchParams;
  if (assinatura === "retorno" && billingConfigured()) {
    await reconcileBusinessSubscription(createServiceClient(), business.id).catch((e) => console.error("reconcile", String(e)));
  }
  const subQuery = (cols: string) => supabase.from("subscriptions").select(cols).eq("business_id", business.id).maybeSingle<Sub>();
  const base = "status, plan, price_cents, trial_ends_at, current_period_end, cancel_at_period_end, provider, provider_subscription_id";
  // Antes de rodar o SQL de pagamentos a coluna last_payment_error ainda não existe
  const first = await subQuery(`${base}, last_payment_error`);
  const sub = first.error ? (await subQuery(base)).data : first.data;
  const plan = await getPlan(supabase, sub?.plan);
  const { data: sample } = await supabase.from("services").select("price_cents").eq("business_id", business.id).eq("active", true).order("sort_order").limit(1).maybeSingle();
  const price = sub?.price_cents ?? plan?.price_cents ?? 0;
  const canPay = billingConfigured() && role === "owner";
  const paid = Boolean(sub?.provider === "stripe" && sub.provider_subscription_id && !["canceled", "expired"].includes(sub.status));
  const testMode = stripeMode() === "test";
  const tz = business.timezone;
  const daysLeft = daysUntil(sub?.trial_ends_at);
  const trialDays = plan?.trial_days ?? 30;
  const noticeDate = sub?.trial_ends_at ? new Date(new Date(sub.trial_ends_at).getTime() - (trialDays - BILLING_NOTICE_DAY) * 86_400_000) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes<HelpTip>Dados do negócio que aparecem para o cliente, as regras que a agenda segue sozinha e a sua assinatura do Só Marcar.</HelpTip></h1>
        <p className="text-sm text-muted">Dados do negócio, regras de agendamento e assinatura.</p>
      </div>
      <SettingsForm business={business} />
      {role !== "professional" && <DepositForm business={business} examplePriceCents={sample?.price_cents ?? 5000} />}

      <section id="assinatura" className="card space-y-3">
        <h2 className="text-lg font-bold">Assinatura<HelpTip>O seu plano do Só Marcar: {brl(price)} por mês, sem comissão. O primeiro mês é grátis e você recebe um aviso antes da primeira cobrança. &quot;Cartão e faturas&quot; abre a área segura da Stripe para trocar o cartão e ver recibos.</HelpTip></h2>
        {assinatura && NOTICES[assinatura] && !(assinatura === "retorno" && paid) && sub?.status !== "active" && <p className="rounded-xl bg-violet-50 p-3 text-sm text-violet-900">{NOTICES[assinatura]}</p>}
        {testMode && role === "owner" && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Modo de teste da Stripe: nenhuma cobrança é real. Use o cartão 4242 4242 4242 4242, qualquer validade futura e qualquer CVC.</p>}
        {sub?.status === "trialing" && (
          <>
            <p><span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">Teste grátis</span> <span className="ml-1">faltam <strong>{daysLeft} dias</strong> (até {formatDate(sub.trial_ends_at!, tz, { day: "numeric", month: "long" })})</span></p>
            {paid && sub.cancel_at_period_end
              ? <p className="text-sm text-muted">Assinatura cancelada. Nada será cobrado e sua agenda funciona até o fim do teste.</p>
              : paid
              ? <p className="text-sm text-muted">Cartão cadastrado. A primeira cobrança de {brl(price)}/mês acontece só quando o teste acabar.</p>
              : <p className="text-sm text-muted">No dia {noticeDate ? formatDate(noticeDate, tz, { day: "numeric", month: "long" }) : BILLING_NOTICE_DAY} você recebe o aviso da primeira cobrança de {brl(price)}/mês. Nada é cobrado antes disso.</p>}
          </>
        )}
        {sub?.status === "active" && <p><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-good">Ativa</span> {brl(price)}/mês{sub.current_period_end ? (sub.cancel_at_period_end ? ` · cancelada, funciona até ${formatDate(sub.current_period_end, tz, { day: "numeric", month: "long" })}` : ` · renova em ${formatDate(sub.current_period_end, tz, { day: "numeric", month: "long" })}`) : ""}</p>}
        {sub?.status === "past_due" && <p className="text-bad">{sub.last_payment_error ?? "Pagamento pendente."} Regularize para não pausar sua agenda.</p>}
        {sub?.status === "canceled" && <p>Assinatura cancelada. Sua agenda funciona até {sub.current_period_end ? formatDate(sub.current_period_end, tz, { day: "numeric", month: "long" }) : "o fim do período"}.</p>}
        {sub?.status === "expired" && <p className="text-bad">Seu acesso expirou. Seus dados ficam guardados para quando quiser voltar.</p>}
        {canPay && !paid && sub && sub.status !== "active" && (
          <form action={startCheckout}><button className="btn btn-primary">{sub.status === "trialing" ? "Cadastrar cartão e garantir a assinatura" : "Assinar agora"}</button></form>
        )}
        {canPay && paid && <form action={openBillingPortal}><button className="btn btn-ghost">{sub?.status === "past_due" ? "Atualizar cartão" : "Cartão e faturas"}</button></form>}
        {role === "owner" && sub && sub.status !== "canceled" && sub.status !== "expired" && !sub.cancel_at_period_end && <CancelButton />}
        <p className="text-xs text-muted">Sem fidelidade e sem multa. Você cancela aqui mesmo, a qualquer momento.</p>
      </section>
    </div>
  );
}
