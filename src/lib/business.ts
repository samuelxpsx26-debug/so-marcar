import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Segment } from "@/lib/segments";
import type { Theme } from "@/lib/theme";
import type { PixKeyType } from "@/lib/pix";

export type Business = {
  id: string; name: string; slug: string; segment: Segment; description: string | null; timezone: string;
  phone: string | null; whatsapp: string | null; email: string | null; theme: Theme;
  min_notice_minutes: number; max_days_ahead: number; slot_step_minutes: number; cancel_notice_minutes: number;
  cancellation_policy: string | null;
  address: { text?: string } | null;
  // Sinal por Pix (ausentes enquanto o SQL do sinal não roda no banco)
  deposit_mode?: "off" | "percent" | "fixed"; deposit_value?: number; deposit_hold_minutes?: number;
  pix_key_type?: PixKeyType | null; pix_key?: string | null; pix_holder?: string | null; pix_city?: string | null;
  // Cartão fidelidade (null = desligado)
  loyalty_visits?: number | null; loyalty_reward?: string | null;
};
export type Role = "owner" | "admin" | "professional";

/** Usuário logado + negócio atual (ou redireciona). Autorização real fica no RLS. */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/entrar");

  const { data: memberships } = await supabase
    .from("business_members")
    .select("role, business:businesses(*)")
    .eq("user_id", userId);

  const list = (memberships ?? []).filter((m) => m.business) as unknown as { role: Role; business: Business }[];
  if (list.length === 0) redirect("/comecar");

  const preferred = (await cookies()).get("biz")?.value;
  const current = list.find((m) => m.business.id === preferred) ?? list[0];
  return { supabase, userId, email: claims.claims.email as string | undefined, role: current.role, business: current.business, businesses: list.map((m) => m.business) };
});

export function canManage(role: Role) {
  return role === "owner" || role === "admin";
}
