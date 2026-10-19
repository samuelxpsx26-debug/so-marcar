"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/business";

export type R = { ok?: boolean; error?: string };

const id = z.string().uuid();

async function setStatus(entryId: string, status: "notified" | "booked" | "removed"): Promise<R> {
  if (!id.safeParse(entryId).success) return { error: "Pedido inválido" };
  const { supabase, business } = await getContext();
  const patch = status === "notified" ? { status, notified_at: new Date().toISOString() } : { status };
  let q = supabase.from("waitlist_entries").update(patch).eq("id", entryId).eq("business_id", business.id);
  // "Avisado" não desfaz um pedido que já virou agendamento
  if (status === "notified") q = q.in("status", ["waiting", "notified"]);
  const { error } = await q;
  revalidatePath("/painel", "layout");
  return error ? { error: "Não foi possível atualizar." } : { ok: true };
}

export async function markWaitlistNotified(entryId: string) {
  return setStatus(entryId, "notified");
}

export async function markWaitlistBooked(entryId: string) {
  return setStatus(entryId, "booked");
}

export async function removeWaitlistEntry(entryId: string) {
  return setStatus(entryId, "removed");
}
