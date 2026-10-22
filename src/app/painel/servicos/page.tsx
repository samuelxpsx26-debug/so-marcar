import type { Metadata } from "next";
import { getContext } from "@/lib/business";
import { ServicesClient } from "./services-client";
import { PackagesClient, type Pkg } from "./packages-client";
import { HelpTip } from "@/components/help-tip";
import { ClubClient } from "./club-client";
import type { ClubPlan } from "@/lib/club";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicosPage() {
  const { supabase, business } = await getContext();
  const pk = await supabase.from("packages").select("id, name, service_id, sessions, price_cents, valid_days, active").eq("business_id", business.id).order("active", { ascending: false }).order("price_cents");
  const [cp, cm] = await Promise.all([
    supabase.from("club_plans").select("id, name, price_cents, sessions_per_month, service_ids, active").eq("business_id", business.id).order("active", { ascending: false }).order("price_cents"),
    supabase.from("club_members").select("plan_id").eq("business_id", business.id).eq("status", "active"),
  ]);
  const members: Record<string, number> = {};
  for (const m of (cm.data ?? []) as { plan_id: string | null }[]) if (m.plan_id) members[m.plan_id] = (members[m.plan_id] ?? 0) + 1;
  const { data } = await supabase.from("services").select("id, name, description, duration_minutes, buffer_minutes, price_cents, active").eq("business_id", business.id).order("active", { ascending: false }).order("sort_order").order("name");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Serviços<HelpTip tutorial="primeiros-passos">O que o cliente pode marcar na sua página. Cada serviço tem nome, duração e preço. A duração bloqueia a agenda pelo tempo certo, então ninguém marca por cima.</HelpTip></h1>
        <p className="text-sm text-muted">Duração e preço aparecem na sua página. O intervalo é o tempo de preparo entre um cliente e outro.</p>
      </div>
      <ServicesClient services={data ?? []} />
      <PackagesClient packages={(pk.data ?? []) as Pkg[]} services={data ?? []} ready={!pk.error} />
      <ClubClient plans={(cp.data ?? []) as ClubPlan[]} services={data ?? []} ready={!cp.error} members={members} />
    </div>
  );
}
