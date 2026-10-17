"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManage, getContext } from "@/lib/business";
import { isSafeImageUrl } from "@/lib/theme";

export type R = { ok?: boolean; error?: string };
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida");

export async function saveTheme(_: R, form: FormData): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  const parsed = z.object({ primary: hex, background: hex, image: z.string().trim().max(500).optional(), description: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { primary, background, image, description } = parsed.data;
  if (image && !isSafeImageUrl(image)) return { error: "A imagem precisa ser um link https" };
  const { error } = await supabase.from("businesses").update({ theme: { primary, background, image: image || null }, description: description || null }).eq("id", business.id);
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/painel", "layout");
  revalidatePath(`/${business.slug}`);
  return { ok: true };
}
