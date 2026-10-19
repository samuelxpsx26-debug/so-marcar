"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/business";

const uuid = /^[0-9a-f-]{36}$/i;

/** Cliente juntou os selos e recebeu o prêmio */
export async function redeemLoyalty(form: FormData) {
  const id = String(form.get("customer_id"));
  if (!uuid.test(id)) return;
  const { supabase } = await getContext();
  await supabase.rpc("redeem_loyalty", { p_customer: id });
  revalidatePath("/painel", "layout");
}

/** Venda de um pacote no balcão (o pagamento é combinado direto com o cliente) */
export async function sellPackage(form: FormData) {
  const customerId = String(form.get("customer_id"));
  const packageId = String(form.get("package_id"));
  if (!uuid.test(customerId) || !uuid.test(packageId)) return;
  const { supabase, business } = await getContext();
  const { data: k } = await supabase.from("packages").select("name, service_id, sessions, price_cents, valid_days").eq("id", packageId).eq("business_id", business.id).eq("active", true).maybeSingle();
  if (!k) return;
  await supabase.from("customer_packages").insert({
    business_id: business.id, customer_id: customerId, package_id: packageId, service_id: k.service_id, name: k.name,
    sessions_total: k.sessions, price_cents: k.price_cents,
    expires_at: k.valid_days ? new Date(Date.now() + k.valid_days * 86_400_000).toISOString() : null,
  });
  revalidatePath("/painel", "layout");
}
