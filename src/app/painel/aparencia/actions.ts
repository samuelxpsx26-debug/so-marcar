"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManage, getContext } from "@/lib/business";
import { THEME_STYLE_IDS, type Theme, type ThemeStyle } from "@/lib/theme";
import { deleteBusinessImage, storeBusinessImage } from "@/lib/media-server";
import { isCatalogBackground } from "@/lib/backgrounds";

export type R = { ok?: boolean; error?: string; url?: string | null };
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida");

function refresh(slug: string) {
  revalidatePath("/painel", "layout");
  revalidatePath(`/${slug}`);
}

// Estilo, cores, fundo e frase. Capa, logo e foto de fundo enviada têm ações próprias e são preservadas aqui.
// Fundo: "auto" (1ª foto do pacote do estilo), "none", um id do pacote ou "upload" (mantém a foto enviada).
export async function saveTheme(_: R, form: FormData): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  const parsed = z.object({ style: z.enum(THEME_STYLE_IDS as [ThemeStyle, ...ThemeStyle[]]), primary: hex, background: hex, bg: z.string().max(40).optional(), description: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { style, primary, background, bg: choice = "upload", description } = parsed.data;
  const { data: cur } = await supabase.from("businesses").select("theme").eq("id", business.id).single();
  const prev = (cur?.theme ?? {}) as Theme;
  const uploaded = prev.bg && !isCatalogBackground(prev.bg) ? prev.bg : null;
  const bg = choice === "none" ? null : choice === "auto" ? undefined : isCatalogBackground(choice) ? choice : choice === "upload" && uploaded ? uploaded : prev.bg;
  const next: Theme = { ...prev, style, primary, background, bg };
  if (bg === undefined) delete next.bg;
  const { error } = await supabase.from("businesses").update({ theme: next, description: description || null }).eq("id", business.id);
  if (error) return { error: "Não foi possível salvar." };
  if (uploaded && bg !== uploaded) await deleteBusinessImage(business.id, uploaded);
  refresh(business.slug);
  return { ok: true };
}

type Slot = "image" | "logo" | "bg";
const SLOT_KIND = { image: "capa", logo: "logo", bg: "fundo" } as const;

async function setThemeImage(slot: Slot, url: string | null): Promise<R> {
  const { supabase, business } = await getContext();
  const { data: cur } = await supabase.from("businesses").select("theme").eq("id", business.id).single();
  const prev = (cur?.theme ?? {}) as Theme;
  const { error } = await supabase.from("businesses").update({ theme: { ...prev, [slot]: url } }).eq("id", business.id);
  if (error) return { error: "Não foi possível salvar." };
  if (prev[slot] !== url) await deleteBusinessImage(business.id, prev[slot]);
  refresh(business.slug);
  return { ok: true, url };
}

async function uploadTo(slot: Slot, form: FormData): Promise<R> {
  const { business, role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  const r = await storeBusinessImage(business.id, SLOT_KIND[slot], form.get("file"));
  if ("error" in r) return { error: r.error };
  return setThemeImage(slot, r.url);
}

export async function uploadCover(form: FormData) { return uploadTo("image", form); }
export async function uploadLogo(form: FormData) { return uploadTo("logo", form); }

export async function removeCover(): Promise<R> {
  const { role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  return setThemeImage("image", null);
}

export async function removeLogo(): Promise<R> {
  const { role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  return setThemeImage("logo", null);
}

export async function uploadBackground(form: FormData) { return uploadTo("bg", form); }

// Tirar a foto enviada volta para a foto do pacote do estilo
export async function removeBackground(): Promise<R> {
  const { supabase, business, role } = await getContext();
  if (!canManage(role)) return { error: "Sem permissão" };
  const { data: cur } = await supabase.from("businesses").select("theme").eq("id", business.id).single();
  const prev = (cur?.theme ?? {}) as Theme;
  const next: Theme = { ...prev };
  delete next.bg;
  const { error } = await supabase.from("businesses").update({ theme: next }).eq("id", business.id);
  if (error) return { error: "Não foi possível salvar." };
  if (prev.bg && !isCatalogBackground(prev.bg)) await deleteBusinessImage(business.id, prev.bg);
  refresh(business.slug);
  return { ok: true, url: null };
}
