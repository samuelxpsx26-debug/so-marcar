import { SEGMENTS, type Segment } from "./segments";

export type Theme = { primary: string; background: string; text?: string; image?: string | null };

const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Texto legível sobre uma cor (preto ou branco, o que contrastar mais) */
export function readableOn(hex: string): string {
  return contrast(hex, "#ffffff") >= contrast(hex, "#111111") ? "#ffffff" : "#111111";
}

export function isSafeImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Aceita o tema salvo e devolve algo sempre legível. Cores inválidas caem no padrão do nicho. */
export function resolveTheme(raw: Partial<Theme> | null | undefined, segment: Segment = "outro") {
  const fallback = SEGMENTS[segment] ?? SEGMENTS.outro;
  const primary = raw?.primary && HEX.test(raw.primary) ? raw.primary : fallback.suggestion.primary;
  const background = raw?.background && HEX.test(raw.background) ? raw.background : fallback.suggestion.background;
  const text = readableOn(background);
  const image = raw?.image && isSafeImageUrl(raw.image) ? raw.image : null;
  return {
    primary,
    background,
    text,
    onPrimary: readableOn(primary),
    image,
    backgroundImage: image ? `linear-gradient(${background}cc, ${background}ee), url("${image}")` : fallback.background,
    lowContrastPrimary: contrast(primary, background) < 2,
  };
}
