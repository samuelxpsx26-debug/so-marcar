import { formatDate, formatTime } from "./format";

export type EmailKind = "confirmation" | "reminder" | "reschedule";

export type EmailData = {
  customerName: string;
  businessName: string;
  serviceName: string;
  professionalName: string;
  startsAt: string;
  timeZone: string;
  manageUrl: string;
  primary?: string;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const COPY: Record<EmailKind, { subject: (d: EmailData) => string; title: string; intro: string }> = {
  confirmation: { subject: (d) => `Horário confirmado em ${d.businessName}`, title: "Seu horário está marcado", intro: "Tudo certo! Guardamos este horário para você." },
  reschedule: { subject: (d) => `Horário remarcado em ${d.businessName}`, title: "Seu horário foi remarcado", intro: "Pronto, o novo horário já está reservado." },
  reminder: { subject: (d) => `Lembrete: seu horário em ${d.businessName}`, title: "Falta pouco para o seu horário", intro: "Passando para lembrar do seu horário." },
};

export function renderEmail(kind: EmailKind, d: EmailData) {
  const c = COPY[kind];
  const first = d.customerName.trim().split(/\s+/)[0];
  const when = `${formatDate(d.startsAt, d.timeZone)} às ${formatTime(d.startsAt, d.timeZone)}`;
  const primary = /^#[0-9a-f]{6}$/i.test(d.primary ?? "") ? d.primary! : "#7c3aed";
  const rows: [string, string][] = [["Quando", when], ["Serviço", d.serviceName], ["Com", d.professionalName]];

  const text = [
    `Olá, ${first}!`, "", c.intro, "",
    ...rows.map(([k, v]) => `${k}: ${v}`), "",
    `Precisa cancelar ou remarcar? ${d.manageUrl}`, "", d.businessName,
  ].join("\n");

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${primary};color:#ffffff;padding:20px 24px;font-size:14px;font-weight:bold">${esc(d.businessName)}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 8px;font-size:22px">${c.title}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">Olá, ${esc(first)}! ${c.intro}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;border-radius:12px">
${rows.map(([k, v]) => `<tr><td style="padding:10px 16px;font-size:13px;color:#71717a;width:80px">${k}</td><td style="padding:10px 16px;font-size:15px;font-weight:bold">${esc(v)}</td></tr>`).join("")}
</table>
<p style="margin:24px 0 0;text-align:center"><a href="${esc(d.manageUrl)}" style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px;font-size:15px">Ver, remarcar ou cancelar</a></p>
</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#a1a1aa;text-align:center">Agendado pelo Só Marcar</td></tr>
</table></td></tr></table></body></html>`;

  return { subject: c.subject(d), html, text };
}

export type TrialNoticeData = {
  ownerName: string;
  businessName: string;
  trialEndsAt: string;
  timeZone: string;
  priceLabel: string; // ex.: "R$ 37,90"
  cardOnFile: boolean;
  settingsUrl: string;
};

/** Aviso ao dono, alguns dias antes do fim do teste grátis: diz exatamente o que vai acontecer. */
export function renderTrialNotice(d: TrialNoticeData) {
  const first = d.ownerName.trim().split(/\s+/)[0] || "Olá";
  const date = formatDate(d.trialEndsAt, d.timeZone, { day: "numeric", month: "long" });
  const subject = `Seu teste grátis do Só Marcar termina em ${date}`;
  const lines = d.cardOnFile
    ? [`No dia ${date} acontece a primeira cobrança de ${d.priceLabel}/mês no cartão que você cadastrou.`, "Não precisa fazer nada. Se preferir não continuar, cancele em Ajustes antes dessa data e nada será cobrado."]
    : [`Seu teste grátis termina no dia ${date}. A assinatura custa ${d.priceLabel}/mês, sem fidelidade e sem comissão.`, "Para sua agenda continuar aberta, cadastre o cartão em Ajustes. Se não quiser continuar, não precisa fazer nada: nada será cobrado."];
  const cta = d.cardOnFile ? "Ver minha assinatura" : "Cadastrar cartão";

  const text = [`${first}, tudo bem?`, "", ...lines, "", `${cta}: ${d.settingsUrl}`, "", "Equipe Só Marcar"].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#7c3aed;color:#ffffff;padding:20px 24px;font-size:14px;font-weight:bold">Só Marcar · ${esc(d.businessName)}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:22px">Seu teste grátis termina em ${esc(date)}</h1>
${lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${esc(l)}</p>`).join("")}
<p style="margin:24px 0 0;text-align:center"><a href="${esc(d.settingsUrl)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px;font-size:15px">${cta}</a></p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}
