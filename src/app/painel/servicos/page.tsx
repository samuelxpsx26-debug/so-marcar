import type { Metadata } from "next";
import { getContext } from "@/lib/business";
import { ServicesClient } from "./services-client";
import { HelpTip } from "@/components/help-tip";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicosPage() {
  const { supabase, business } = await getContext();
  const { data } = await supabase.from("services").select("id, name, description, duration_minutes, buffer_minutes, price_cents, active").eq("business_id", business.id).order("active", { ascending: false }).order("sort_order").order("name");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Serviços<HelpTip>O que o cliente pode marcar na sua página. Cada serviço tem nome, duração e preço. A duração bloqueia a agenda pelo tempo certo, então ninguém marca por cima.</HelpTip></h1>
        <p className="text-sm text-muted">Duração e preço aparecem na sua página. O intervalo é o tempo de preparo entre um cliente e outro.</p>
      </div>
      <ServicesClient services={data ?? []} />
    </div>
  );
}
