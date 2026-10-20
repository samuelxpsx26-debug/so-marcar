// Variáveis públicas (podem ir para o navegador). A service_role NUNCA entra aqui.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Endereço público para links compartilhados (domínio oficial em produção; local/preview usam o endereço atual). */
export function publicOrigin() {
  if (SITE_URL.startsWith("https://")) return SITE_URL;
  return typeof window !== "undefined" ? window.location.origin : SITE_URL;
}
