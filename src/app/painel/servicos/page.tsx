import type { Metadata } from "next";
import { getContext } from "@/lib/business";
import { ServicesClient } from "./services-client";
import { PackagesClient, type Pkg } from "./packages-client";
import { HelpTip } from "@/components/help-tip";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicosPage() {
  const { supabase, business } = await getContext();
  const pk = await supabase.from("packages").select("id, name, service_id, sessions, price_cents, valid_days, active").eq("business_id", business.id).order("active", { ascending: false }).order("price_cents");
  const { data } = await supabase.from("services").select("id, name, description, duration_minutes, buffer_minutes, price_cents, active").eq("business_id", business.id).order("active", { ascending: false }).order("sort_order").order("name");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Serviços<HelpTip>O que o cliente pode marcar na sua página. Cada serviço tem nome, duração e preço. A duração bloqueia a agenda pelo tempo certo, então ninguém marca por cima.</HelpTip></h1>
        <p className="text-sm text-muted">Duração e preço aparecem na sua página. O intervalo é o tempo de preparo entre um cliente e outro.</p>
      </div>
      <ServicesClient services={data ?? []} />
      <PackagesClient packages={(pk.data ?? []) as Pkg[]} services={data ?? []} ready={!pk.error} />
    </div>
  );
}
