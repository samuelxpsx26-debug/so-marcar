import type { Metadata } from "next";
import { getContext } from "@/lib/business";
import { TeamClient } from "./team-client";

export const metadata: Metadata = { title: "Equipe" };

export default async function EquipePage() {
  const { supabase, business } = await getContext();
  const [{ data: pros }, { data: hours }, { data: services }, { data: links }, { data: off }] = await Promise.all([
    supabase.from("professionals").select("id, name, bio, active, avatar_url").eq("business_id", business.id).order("active", { ascending: false }).order("sort_order").order("name"),
    supabase.from("working_hours").select("professional_id, weekday, start_time, end_time").eq("business_id", business.id).order("start_time"),
    supabase.from("services").select("id, name").eq("business_id", business.id).eq("active", true).order("name"),
    supabase.from("professional_services").select("professional_id, service_id").eq("business_id", business.id),
    supabase.from("time_off").select("id, professional_id, starts_at, ends_at, reason").eq("business_id", business.id).gte("ends_at", new Date().toISOString()).order("starts_at"),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipe e horários</h1>
        <p className="text-sm text-muted">Cada profissional tem seus dias, horários, pausas (como o almoço), serviços e folgas.</p>
      </div>
      <TeamClient timezone={business.timezone} professionals={pros ?? []} hours={hours ?? []} services={services ?? []} links={links ?? []} timeOff={off ?? []} />
    </div>
  );
}
