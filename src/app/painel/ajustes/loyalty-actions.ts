"use server";
import { revalidatePath } from "next/cache";
import { canManage, getContext } from "@/lib/business";

export type R = { ok?: boolean; error?: string };

export async function saveLoyalty(_: R, form: FormData): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Só o dono ou administrador altera o cartão fidelidade." };
  const enabled = form.get("enabled") === "on";
  const visits = Number(form.get("visits"));
  const reward = String(form.get("reward") ?? "").trim();
  if (enabled && !(Number.isInteger(visits) && visits >= 2 && visits <= 50)) return { error: "Escolha de 2 a 50 atendimentos." };
  if (enabled && (reward.length < 2 || reward.length > 80)) return { error: "Escreva o prêmio (ex.: 1 corte grátis)." };
  const { error } = await supabase.from("businesses")
    .update(enabled ? { loyalty_visits: visits, loyalty_reward: reward } : { loyalty_visits: null }).eq("id", business.id);
  if (error?.code === "42703" || error?.code === "PGRST204") return { error: "O cartão fidelidade ainda não está liberado no seu banco. Rode o arquivo supabase-fidelidade-pacotes.sql no Supabase." };
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/painel", "layout");
  return { ok: true };
}
