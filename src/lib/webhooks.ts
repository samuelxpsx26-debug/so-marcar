import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Registra o evento uma única vez (provider + event_id). Se já foi processado, devolve
 * `duplicate: true` e quem chamou não faz nada. Guardamos só um resumo, sem dados pessoais.
 */
export async function recordWebhook(db: SupabaseClient, provider: string, eventId: string, eventType: string, summary: Record<string, unknown>) {
  const { data: inserted } = await db.from("webhook_events")
    .upsert({ provider, event_id: eventId, event_type: eventType, payload: summary }, { onConflict: "provider,event_id", ignoreDuplicates: true })
    .select("id, processed_at, attempts");
  const row = inserted?.[0] ?? (await db.from("webhook_events").select("id, processed_at, attempts").eq("provider", provider).eq("event_id", eventId).single()).data;
  if (!row) throw new Error("webhook_events: não foi possível registrar");
  return { id: row.id as string, duplicate: Boolean(row.processed_at), attempts: row.attempts as number };
}

export async function finishWebhook(db: SupabaseClient, id: string, attempts: number, error?: unknown) {
  await db.from("webhook_events").update(error
    ? { attempts: attempts + 1, error: String(error).slice(0, 500) }
    : { attempts: attempts + 1, processed_at: new Date().toISOString(), error: null }).eq("id", id);
}
