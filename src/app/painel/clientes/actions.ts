"use server";
import { revalidatePath } from "next/cache";
import { canManage, getContext } from "@/lib/business";

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

/** Junta outra ficha nesta: visitas, pacotes, prêmios e lista de espera passam para a ficha que fica, e a outra é apagada */
export async function mergeCustomer(keepId: string, dupId: string): Promise<{ error?: string; ok?: boolean }> {
  if (!uuid.test(keepId) || !uuid.test(dupId) || keepId === dupId) return { error: "Escolha outra ficha." };
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Só o dono ou um administrador pode juntar fichas." };
  const { data: both } = await supabase.from("customers").select("id, email, notes, marketing_consent").eq("business_id", business.id).in("id", [keepId, dupId]);
  const keep = both?.find((c) => c.id === keepId);
  const dup = both?.find((c) => c.id === dupId);
  if (!keep || !dup) return { error: "Ficha não encontrada." };

  const move = (table: string) => supabase.from(table).update({ customer_id: keepId }).eq("business_id", business.id).eq("customer_id", dupId);
  const steps = await Promise.all([move("appointments"), move("loyalty_redemptions"), move("customer_packages")]);
  // Tabelas de fidelidade e pacotes podem não existir ainda; atendimento que não muda é erro de verdade
  if (steps[0].error) return { error: "Não foi possível mover os atendimentos. Tente de novo." };

  // Lista de espera: pedido repetido (mesmo serviço e dia) fica só o da ficha que fica
  const { data: waits } = await supabase.from("waitlist_entries").select("id, customer_id, service_id, desired_date").eq("business_id", business.id).in("customer_id", [keepId, dupId]);
  if (waits) {
    const kept = new Set(waits.filter((w) => w.customer_id === keepId).map((w) => `${w.service_id}|${w.desired_date}`));
    const repeated = waits.filter((w) => w.customer_id === dupId && kept.has(`${w.service_id}|${w.desired_date}`)).map((w) => w.id);
    if (repeated.length) await supabase.from("waitlist_entries").delete().in("id", repeated);
    await move("waitlist_entries");
  }

  await supabase.from("customers").update({
    email: keep.email ?? dup.email, notes: [keep.notes, dup.notes].filter(Boolean).join("\n").slice(0, 2000) || null,
    marketing_consent: keep.marketing_consent || dup.marketing_consent,
  }).eq("id", keepId).eq("business_id", business.id);
  const { error } = await supabase.from("customers").delete().eq("id", dupId).eq("business_id", business.id);
  if (error) return { error: "As visitas foram movidas, mas a ficha antiga não pôde ser apagada. Tente de novo." };
  revalidatePath("/painel", "layout");
  return { ok: true };
}
