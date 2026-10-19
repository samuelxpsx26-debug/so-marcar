"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isValidSlug, slugify } from "@/lib/slug";
import { SEGMENTS, type Segment } from "@/lib/segments";
import { normalizePhone } from "@/lib/format";
import { styleForSegment, THEME_STYLES } from "@/lib/theme";

export type OnboardState = { error?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome do negócio").max(120),
  slug: z.string().trim().toLowerCase(),
  segment: z.enum(Object.keys(SEGMENTS) as [Segment, ...Segment[]]),
  whatsapp: z.string().trim().refine((v) => /^\d{12,13}$/.test(normalizePhone(v)), "WhatsApp inválido (com DDD)"),
  serviceName: z.string().trim().min(2, "Informe um serviço").max(120),
  duration: z.coerce.number().int().min(5).max(720),
  price: z.string().trim(),
});

export async function createBusiness(_: OnboardState, form: FormData): Promise<OnboardState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const slug = slugify(d.slug || d.name);
  if (!isValidSlug(slug)) return { error: "Escolha outro endereço (use letras, números e hífen)." };
  const priceCents = Math.round(Number(d.price.replace(/\./g, "").replace(",", ".") || "0") * 100);
  if (!Number.isFinite(priceCents) || priceCents < 0) return { error: "Preço inválido" };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_business", { p_name: d.name, p_slug: slug, p_segment: d.segment, p_timezone: "America/Sao_Paulo" });
  if (error || !id) return { error: error?.message?.includes("endereço") ? "Esse endereço já está em uso, escolha outro." : "Não foi possível criar agora. Tente de novo." };

  // Começa com o estilo do nicho (o mesmo da página inicial); o dono troca em Aparência
  const style = styleForSegment(d.segment);
  const colors = THEME_STYLES[style].defaults;
  await supabase.from("businesses").update({
    whatsapp: normalizePhone(d.whatsapp),
    theme: { style, primary: colors.primary, background: colors.background, image: null },
  }).eq("id", id);
  await supabase.from("services").insert({ business_id: id, name: d.serviceName, duration_minutes: d.duration, price_cents: priceCents });

  redirect("/painel?bemvindo=1");
}
