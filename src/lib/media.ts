// Fotos enviadas pelo dono (capa, logo, profissionais). Validação pura aqui; envio em media-server.ts.

export const MEDIA_BUCKET = "midia";
export const MEDIA_MAX_BYTES = 2 * 1024 * 1024;
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];
export type MediaKind = "capa" | "logo" | "profissional";

/** Tamanho máximo (lado maior, em px) que o navegador gera antes de enviar */
export const MEDIA_MAX_SIDE: Record<MediaKind, number> = { capa: 1600, logo: 512, profissional: 512 };

/** Descobre o tipo pelo conteúdo do arquivo, sem confiar na extensão ou no que o navegador declarou */
export function sniffImage(bytes: Uint8Array): MediaType | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export const MEDIA_EXT: Record<MediaType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Caminho do arquivo no bucket se a URL for uma foto nossa (para apagar a antiga ao trocar) */
export function mediaPathFromUrl(url: string | null | undefined, supabaseUrl: string): string | null {
  if (!url || !supabaseUrl) return null;
  const prefix = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/`;
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
}
