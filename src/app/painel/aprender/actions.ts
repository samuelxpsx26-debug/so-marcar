"use server";
import { getContext } from "@/lib/business";

export type R = { ok?: boolean; error?: string };

export async function sendSuggestion(_: R, form: FormData): Promise<R> {
  const { supabase, business } = await getContext();
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 5) return { error: "Escreva sua sugestão com um pouco mais de detalhe." };
  if (body.length > 1000) return { error: "A sugestão pode ter até 1000 letras." };
  const { error } = await supabase.from("suggestions").insert({ business_id: business.id, body, page: "aprender" });
  if (error) return { error: ["42P01", "PGRST205"].includes(error.code) ? "As sugestões ainda estão sendo ativadas. Tente de novo mais tarde." : "Não foi possível enviar. Tente de novo." };
  return { ok: true };
}
