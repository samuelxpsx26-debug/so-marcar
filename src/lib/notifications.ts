import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import { renderEmail, type EmailKind } from "@/lib/email-templates";

const MAX_ATTEMPTS = 3;
// Com o cron diário (plano Hobby) o lembrete sai até estas horas antes do previsto (24h antes do horário).
const REMINDER_EARLY_HOURS = Number(process.env.REMINDER_EARLY_HOURS ?? 12);
const SENDABLE: EmailKind[] = ["confirmation", "reminder", "reschedule"];

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(to: string, msg: { subject: string; html: string; text: string }, replyTo?: string | null) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: msg.subject, html: msg.html, text: msg.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

type Job = {
  id: string; kind: string; channel: string; attempts: number;
  appointment: {
    status: string; starts_at: string; manage_token: string;
    customer: { name: string; email: string | null } | null;
    service: { name: string } | null;
    professional: { name: string } | null;
    business: { name: string; email: string | null; timezone: string; theme: { primary?: string } | null } | null;
  } | null;
};

/** Envia os e-mails pendentes que já venceram. Com `manageToken`, só os daquela reserva. */
export async function processNotifications(opts: { manageToken?: string; limit?: number } = {}) {
  const summary = { sent: 0, failed: 0, skipped: 0 };
  if (!emailConfigured()) return { ...summary, configured: false };

  const db = createServiceClient();
  const now = new Date();
  // Reservas com sinal vencido são canceladas antes (e seus e-mails pulados)
  await db.rpc("expire_unpaid_deposits", {}).then(() => null, () => null);
  const early = new Date(now.getTime() + REMINDER_EARLY_HOURS * 3_600_000).toISOString();
  let q = db.from("notification_jobs")
    .select(`id, kind, channel, attempts, appointment:appointments!inner(status, starts_at, manage_token,
      customer:customers(name, email), service:services(name), professional:professionals(name),
      business:businesses(name, email, timezone, theme))`)
    .eq("status", "pending").eq("channel", "email")
    // Na hora da reserva só sai o que venceu; o cron também adianta os lembretes.
    .or(opts.manageToken ? `scheduled_for.lte.${now.toISOString()}` : `scheduled_for.lte.${now.toISOString()},and(kind.eq.reminder,scheduled_for.lte.${early})`)
    .order("scheduled_for").limit(opts.limit ?? 50);
  if (opts.manageToken) q = q.eq("appointment.manage_token", opts.manageToken);
  const { data, error } = await q;
  if (error) throw new Error(`notification_jobs: ${error.message}`);

  for (const job of (data ?? []) as unknown as Job[]) {
    const a = job.appointment;
    // "Pendente" = esperando o Pix do sinal: o lembrete espera a confirmação
    if (a?.status === "pending" && new Date(a.starts_at) > now) continue;
    const skip = !a || !a.customer?.email || !a.business || !SENDABLE.includes(job.kind as EmailKind)
      || !["pending", "confirmed"].includes(a.status) || new Date(a.starts_at) <= now;
    if (skip) {
      await db.from("notification_jobs").update({ status: "skipped" }).eq("id", job.id);
      summary.skipped++;
      continue;
    }
    try {
      const msg = renderEmail(job.kind as EmailKind, {
        customerName: a.customer!.name, businessName: a.business!.name, serviceName: a.service?.name ?? "",
        professionalName: a.professional?.name ?? "", startsAt: a.starts_at, timeZone: a.business!.timezone,
        manageUrl: `${SITE_URL}/reserva/${a.manage_token}`, primary: a.business!.theme?.primary,
      });
      await sendEmail(a.customer!.email!, msg, a.business!.email);
      await db.from("notification_jobs").update({ status: "sent", sent_at: new Date().toISOString(), attempts: job.attempts + 1 }).eq("id", job.id);
      summary.sent++;
    } catch (e) {
      const attempts = job.attempts + 1;
      await db.from("notification_jobs").update({ attempts, last_error: String(e).slice(0, 500), status: attempts >= MAX_ATTEMPTS ? "failed" : "pending" }).eq("id", job.id);
      console.error("notification", job.id, String(e));
      summary.failed++;
    }
  }
  return { ...summary, configured: true };
}
