import type { ThemeStyle } from "./theme";
import type { Segment } from "./segments";
import { findPattern, PATTERNS, patternDataUri, type Pattern, type PatternNiche } from "./patterns";

// Fundos da página de agendamento: fotos de ambiente por estilo (escurecidas), fotos limpas por nicho
// (clareadas) e estampas desenhadas por nicho (patterns.ts).
// Pacote de fotos de fundo por estilo. Todas gratuitas para uso comercial (Licença Unsplash),
// servidas direto do CDN do Unsplash, que redimensiona e comprime para cada tela.
export type Backdrop = { id: string; photo: string; by: string; alt: string };

export const BACKDROPS: Record<ThemeStyle, Backdrop[]> = {
  couro: [
    { id: "couro-1", photo: "photo-1781455793310-8427c96454c7", by: "Barney Goodman", alt: "Barbearia retrô com cadeiras de couro" },
    { id: "couro-2", photo: "photo-1773904215697-e6c21fc27ac2", by: "T", alt: "Barbearia à meia-luz com cadeiras e pias" },
    { id: "couro-3", photo: "photo-1585747860715-2ba37e788b70", by: "Nathon Oski", alt: "Cadeira de barbeiro junto a parede de tijolos" },
    { id: "couro-4", photo: "photo-1621645582931-d1d3e6564943", by: "Joshua Lawrence", alt: "Cadeira de barbeiro preta e prata" },
  ],
  champagne: [
    { id: "champagne-1", photo: "photo-1781450090585-1a511b7066d9", by: "Barney Goodman", alt: "Salão claro com arcos e cadeiras" },
    { id: "champagne-2", photo: "photo-1536520002442-39764a41e987", by: "Jason Leung", alt: "Salão com luminárias pendentes" },
    { id: "champagne-3", photo: "photo-1595871151608-bc7abd1caca3", by: "Atikah Akhtar", alt: "Penteadeira de madeira com espelho" },
    { id: "champagne-4", photo: "photo-1570172619644-dfd03ed5d881", by: "Rosa Rafael", alt: "Tratamento facial em spa" },
  ],
  neon: [
    { id: "neon-1", photo: "photo-1517762340357-3a82e505f7c4", by: "reda rachdi", alt: "Letreiro neon de estúdio de tatuagem à noite" },
    { id: "neon-2", photo: "photo-1568515045052-f9a854d70bfd", by: "Allef Vinicius", alt: "Tatuagem sendo feita, em close" },
    { id: "neon-3", photo: "photo-1565058379802-bbe93b2f703a", by: "Lucas Lenzi", alt: "Tatuador trabalhando no braço do cliente" },
    { id: "neon-4", photo: "photo-1595747644932-abb68f85f419", by: "Kevin Turcios", alt: "Estúdio de tatuagem por dentro" },
  ],
  energia: [
    { id: "energia-1", photo: "photo-1778828494354-9b717d36dc99", by: "Salman Sidheek", alt: "Academia escura com aparelhos" },
    { id: "energia-2", photo: "photo-1689877020200-403d8542d95d", by: "Rick Barrett", alt: "Academia com máquinas e pesos" },
    { id: "energia-3", photo: "photo-1734630341082-0fec0e10126c", by: "Jason Grant", alt: "Fileira de halteres" },
    { id: "energia-4", photo: "photo-1590487988256-9ed24133863e", by: "Brett Jordan", alt: "Pesos em preto e branco" },
  ],
  moderno: [
    { id: "moderno-1", photo: "photo-1611920630905-426e08849c32", by: "visualsofdana", alt: "Planta sobre mesa de madeira" },
    { id: "moderno-2", photo: "photo-1583417657209-d3dd44dc9c09", by: "HUUM", alt: "Mesa redonda junto a parede de concreto" },
    { id: "moderno-3", photo: "photo-1761470575018-135c213340eb", by: "Dominik Neuner", alt: "Ambiente de pedra com vela e luz suave" },
  ],
};

// Fotos limpas (produtos sobre fundo liso), mostradas clareadas com texto escuro por cima
export const CLEAN_PHOTOS: Record<PatternNiche, Backdrop[]> = {
  barbearia: [{ id: "limpa-barbearia-1", photo: "photo-1596362601603-b74f6ef166e4", by: "Sinval Carvalho", alt: "Tesoura e pente" }],
  unhas: [
    { id: "limpa-unhas-1", photo: "photo-1602585578130-c9076e09330d", by: "pure julia", alt: "Esmaltes rosa e preto" },
    { id: "limpa-unhas-2", photo: "photo-1636019411401-82485711b6ba", by: "Maria Lupan", alt: "Esmaltes coloridos" },
  ],
  cabelo: [{ id: "limpa-cabelo-1", photo: "photo-1522336284037-91f7da073525", by: "Element5 Digital", alt: "Secador e pente" }],
  estetica: [
    { id: "limpa-estetica-1", photo: "photo-1631730486572-226d1f595b68", by: "pmv chamara", alt: "Produtos de beleza em fundo rosa" },
    { id: "limpa-estetica-2", photo: "photo-1612817288484-6f916006741a", by: "Elsa Olofsson", alt: "Cosméticos com pedras e folhas" },
  ],
  tatuagem: [],
  fitness: [
    { id: "limpa-fitness-1", photo: "photo-1591291621164-2c6367723315", by: "Elena Kloppenburg", alt: "Halteres sobre tapete rosa" },
    { id: "limpa-fitness-2", photo: "photo-1783632895890-a3b05fae1754", by: "Moment InFocus", alt: "Luva de boxe e elástico em fundo roxo" },
  ],
  geral: [],
};

const DARK = Object.values(BACKDROPS).flat();
const CLEAN = Object.values(CLEAN_PHOTOS).flat();

export function findBackdrop(id: string | null | undefined): Backdrop | null {
  return (id && (DARK.find((b) => b.id === id) || CLEAN.find((b) => b.id === id))) || null;
}

/** id de qualquer fundo do catálogo (foto ou estampa); falso para foto enviada pelo dono */
export const isCatalogBackground = (id: string | null | undefined) => !!(findBackdrop(id) || findPattern(id));

const SEGMENT_NICHE: Record<Segment, PatternNiche> = {
  barbearia: "barbearia", salao: "cabelo", manicure: "unhas", estetica: "estetica", clinica: "estetica",
  tatuagem: "tatuagem", personal: "fitness", estudio: "fitness", autonomo: "geral", outro: "geral",
};
export const nicheForSegment = (segment: Segment): PatternNiche => SEGMENT_NICHE[segment] ?? "geral";

export type Layer = { kind: "foto" | "estampa"; image: string; tone: "light" | "dark"; ground?: string };

/** Camada de fundo de um tema: ausente = 1ª foto do estilo, null = nenhuma */
export function backgroundLayer(bg: string | null | undefined, style: ThemeStyle, safeUrl: (u: string) => boolean): Layer | null {
  if (bg === null) return null;
  if (bg === undefined) return { kind: "foto", image: backdropUrl(BACKDROPS[style][0]), tone: "dark" };
  const pattern = findPattern(bg);
  if (pattern) return { kind: "estampa", image: patternDataUri(pattern), tone: pattern.tone, ground: pattern.ground };
  const clean = CLEAN.find((b) => b.id === bg);
  if (clean) return { kind: "foto", image: backdropUrl(clean), tone: "light" };
  const dark = DARK.find((b) => b.id === bg);
  if (dark) return { kind: "foto", image: backdropUrl(dark), tone: "dark" };
  return safeUrl(bg) ? { kind: "foto", image: bg, tone: "dark" } : null;
}

export type CatalogItem = { id: string; label: string; thumb: string; credit?: string; pattern?: Pattern };

/** Opções do seletor, com as do nicho do cliente primeiro */
export function backgroundCatalog(segment: Segment, style: ThemeStyle): { mine: CatalogItem[]; more: { title: string; items: CatalogItem[] }[] } {
  const niche = nicheForSegment(segment);
  const pat = (p: Pattern): CatalogItem => ({ id: p.id, label: p.label, thumb: patternDataUri(p), pattern: p });
  const photo = (b: Backdrop): CatalogItem => ({ id: b.id, label: b.alt, thumb: backdropUrl(b, 360), credit: `Foto: ${b.by} / Unsplash` });
  const NICHE_LABEL: Record<PatternNiche, string> = { barbearia: "Barbearia", unhas: "Unhas", cabelo: "Cabelo", estetica: "Estética", tatuagem: "Tatuagem", fitness: "Treino", geral: "Geral" };
  const STYLE_NICHE: Record<ThemeStyle, PatternNiche> = { couro: "barbearia", champagne: "cabelo", neon: "tatuagem", energia: "fitness", moderno: "geral" };
  const darkFor = (n: PatternNiche) => (Object.keys(STYLE_NICHE) as ThemeStyle[]).filter((st) => STYLE_NICHE[st] === n).flatMap((st) => BACKDROPS[st]);
  const itemsFor = (n: PatternNiche) => [...PATTERNS.filter((p) => p.niche === n).map(pat), ...CLEAN_PHOTOS[n].map(photo), ...darkFor(n).map(photo)];
  // Do nicho do cliente; o pacote do estilo escolhido entra junto se for de outro nicho
  const mine = [...itemsFor(niche), ...(STYLE_NICHE[style] === niche ? [] : BACKDROPS[style].map(photo))];
  const seen = new Set(mine.map((i) => i.id));
  const more = (Object.keys(NICHE_LABEL) as PatternNiche[]).filter((n) => n !== niche).map((n) => {
    const items = itemsFor(n).filter((i) => !seen.has(i.id));
    return { title: NICHE_LABEL[n], items };
  }).filter((g) => g.items.length);
  return { mine, more };
}

export function backdropUrl(b: Backdrop, width = 1600): string {
  return `https://images.unsplash.com/${b.photo}?auto=format&fit=crop&w=${width}&q=60`;
}
