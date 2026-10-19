import { SEGMENTS, type Segment } from "./segments";
import { BACKDROPS, backdropUrl, findBackdrop } from "./backgrounds";

export type ThemeStyle = "couro" | "champagne" | "neon" | "energia" | "moderno";

export type Theme = { primary: string; background: string; text?: string; image?: string | null; logo?: string | null; style?: ThemeStyle;
  /** Foto de fundo da página: id do pacote ("couro-1"), URL enviada pelo dono, null = sem foto, ausente = 1ª do pacote do estilo */
  bg?: string | null };

type StyleInfo = {
  label: string;
  hint: string;
  defaults: { primary: string; background: string };
  /** Fonte do título (variáveis de next/font carregadas em brandFonts) */
  display: { family: string; weight: number; style: "normal" | "italic"; transform: "none" | "uppercase"; tracking: string };
};

// Estilos visuais da página de agendamento, os mesmos da página inicial por nicho
export const THEME_STYLES: Record<ThemeStyle, StyleInfo> = {
  couro: { label: "Couro & Navalha", hint: "Clássico e marcante", defaults: { primary: "#d9a84e", background: "#15110d" }, display: { family: "var(--font-playfair), Georgia, serif", weight: 900, style: "normal", transform: "none", tracking: "-0.01em" } },
  champagne: { label: "Champagne & Rosé", hint: "Elegante e delicado", defaults: { primary: "#9a4558", background: "#f6efe8" }, display: { family: "var(--font-cormorant), Georgia, serif", weight: 600, style: "italic", transform: "none", tracking: "-0.01em" } },
  neon: { label: "Tinta & Neon", hint: "Ousado e urbano", defaults: { primary: "#ff4d78", background: "#0a0a0c" }, display: { family: "var(--font-archivo-black), Impact, sans-serif", weight: 400, style: "normal", transform: "uppercase", tracking: "-0.02em" } },
  energia: { label: "Energia & Foco", hint: "Esportivo e vibrante", defaults: { primary: "#c8f03c", background: "#0d1411" }, display: { family: "var(--font-barlow), Impact, sans-serif", weight: 800, style: "italic", transform: "uppercase", tracking: "0" } },
  moderno: { label: "Moderno", hint: "Limpo e versátil", defaults: { primary: "#7c3aed", background: "#ffffff" }, display: { family: "var(--font-manrope), system-ui, sans-serif", weight: 800, style: "normal", transform: "none", tracking: "-0.03em" } },
};

export const THEME_STYLE_IDS = Object.keys(THEME_STYLES) as ThemeStyle[];

const SEGMENT_STYLE: Record<Segment, ThemeStyle> = {
  barbearia: "couro", salao: "champagne", manicure: "champagne", estetica: "champagne", tatuagem: "neon",
  personal: "energia", estudio: "energia", autonomo: "moderno", clinica: "moderno", outro: "moderno",
};

export function styleForSegment(segment: Segment): ThemeStyle {
  return SEGMENT_STYLE[segment] ?? "moderno";
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

/** Textura de fundo do estilo, montada a partir das cores escolhidas pelo dono */
function styleTexture(style: ThemeStyle, primary: string, dark: boolean): string {
  const line = dark ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.035)";
  const glow = `radial-gradient(900px 520px at 88% -8%, ${rgba(primary, dark ? 0.2 : 0.14)}, transparent 60%)`;
  switch (style) {
    case "couro": return `${glow}, repeating-linear-gradient(0deg, ${dark ? "rgba(0,0,0,.3)" : "rgba(0,0,0,.04)"} 0 3px, transparent 3px 46px), repeating-linear-gradient(90deg, ${line} 0 2px, transparent 2px 92px)`;
    case "champagne": return `${glow}, radial-gradient(800px 560px at 0% 40%, ${dark ? "rgba(214,178,132,.10)" : "rgba(214,178,132,.22)"}, transparent 60%)`;
    case "neon": return `${glow}, repeating-linear-gradient(135deg, ${line} 0 1px, transparent 1px 14px)`;
    case "energia": return `${glow}, repeating-linear-gradient(90deg, ${line} 0 1px, transparent 1px 64px), repeating-linear-gradient(0deg, ${line} 0 1px, transparent 1px 64px)`;
    default: return glow;
  }
}

/** Faixa de capa do topo da página (sem foto) */
function styleCover(style: ThemeStyle, primary: string): string {
  const shade = "linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.72))";
  const base = `radial-gradient(circle at 75% 20%, ${rgba(primary, 0.95)}, ${rgba(primary, 0.35)} 55%, #0b0b0e 100%)`;
  switch (style) {
    case "couro": return `${shade}, repeating-linear-gradient(0deg, rgba(0,0,0,.4) 0 4px, transparent 4px 30px), repeating-linear-gradient(90deg, rgba(0,0,0,.25) 0 4px, transparent 4px 60px), ${base}`;
    case "neon": return `${shade}, repeating-linear-gradient(135deg, ${rgba(primary, 0.35)} 0 2px, transparent 2px 18px), radial-gradient(circle at 70% 30%, #2a1630, #0b0b10 75%)`;
    case "energia": return `${shade}, repeating-linear-gradient(115deg, ${rgba(primary, 0.28)} 0 6px, transparent 6px 26px), radial-gradient(circle at 30% 30%, #24382e, #0d1411 75%)`;
    default: return `${shade}, ${base}`;
  }
}

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

/** URL da foto de fundo: do pacote, enviada pelo dono, ou nenhuma */
export function backgroundPhoto(bg: string | null | undefined, style: ThemeStyle): string | null {
  if (bg === null) return null;
  if (bg === undefined) return backdropUrl(BACKDROPS[style][0]);
  const pack = findBackdrop(bg);
  if (pack) return backdropUrl(pack);
  return isSafeImageUrl(bg) ? bg : null;
}

/** Aceita o tema salvo e devolve algo sempre legível. Cores inválidas caem no padrão do nicho. */
export function resolveTheme(raw: Partial<Theme> | null | undefined, segment: Segment = "outro") {
  const fallback = SEGMENTS[segment] ?? SEGMENTS.outro;
  const primary = raw?.primary && HEX.test(raw.primary) ? raw.primary : fallback.suggestion.primary;
  const background = raw?.background && HEX.test(raw.background) ? raw.background : fallback.suggestion.background;
  const text = readableOn(background);
  const image = raw?.image && isSafeImageUrl(raw.image) ? raw.image : null;
  const logo = raw?.logo && isSafeImageUrl(raw.logo) ? raw.logo : null;
  const style: ThemeStyle = raw?.style && raw.style in THEME_STYLES ? raw.style : styleForSegment(segment);
  const photo = backgroundPhoto(raw?.bg, style);
  // Com foto de fundo a página fica escura (como uma vitrine à noite): texto claro e cartões translúcidos
  const pageText = photo ? "#ffffff" : text;
  const dark = pageText === "#ffffff";
  return {
    style,
    display: THEME_STYLES[style].display,
    cover: image ? `linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.7)), url("${image}")` : styleCover(style, primary),
    primary,
    background,
    text: pageText,
    onPrimary: readableOn(primary),
    image,
    logo,
    backgroundImage: styleTexture(style, primary, dark),
    photo,
    /** Camada fixa atrás da página: foto escurecida com um brilho da cor do negócio */
    backdrop: photo ? `radial-gradient(1000px 600px at 85% -10%, ${rgba(primary, 0.22)}, transparent 60%), linear-gradient(180deg, rgba(8,8,10,.5), rgba(8,8,10,.78) 60%, rgba(8,8,10,.9)), url("${photo}")` : null,
    surface: photo ? "rgba(14,14,17,.62)" : dark ? "#ffffff14" : "#0000000a",
    lowContrastPrimary: contrast(primary, photo ? "#141416" : background) < 2,
  };
}
