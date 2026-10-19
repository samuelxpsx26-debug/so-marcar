// Estampas de fundo desenhadas para o Só Marcar: ícones de traço de cada nicho repetidos em mosaico.
// Geradas aqui como SVG (sem arquivo nem foto de terceiros), leves e nítidas em qualquer tela.

export type PatternNiche = "barbearia" | "unhas" | "cabelo" | "estetica" | "tatuagem" | "fitness" | "geral";
export type Pattern = { id: string; niche: PatternNiche; label: string; ground: string; ink: string[]; tone: "light" | "dark" };

// Ícones em grade 48×48, só traço (o SVG aplica cor e espessura)
const ICONS: Record<string, string> = {
  tesoura: '<circle cx="14" cy="37" r="6"/><circle cx="34" cy="37" r="6"/><path d="M18 32 33 6M30 32 15 6"/>',
  pente: '<rect x="6" y="14" width="36" height="8" rx="2"/><path d="M10 22v12M14 22v12M18 22v12M22 22v12M26 22v12M30 22v12M34 22v12M38 22v12"/>',
  navalha: '<path d="M6 13h26a5 5 0 0 1 0 10H6z"/><path d="M10 18h18M31 23l9 14a3 3 0 0 1-5 3l-9-15"/>',
  poste: '<rect x="17" y="9" width="14" height="30" rx="3"/><path d="M13 7h22M13 41h22M17 17l14-6M17 25l14-6M17 33l14-6M17 40l14-6"/>',
  bigode: '<path d="M24 21c-3-5-9-5-12-1-2 3-6 4-9 2 2 7 10 8 15 4 3-2 5-3 6-5 1 2 3 3 6 5 5 4 13 3 15-4-3 2-7 1-9-2-3-4-9-4-12 1z"/>',
  pincel: '<path d="M16 22c0-10 4-16 8-16s8 6 8 16z"/><path d="M18 22h12l-1 6H19zM18 28h12v10a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"/>',
  maquina: '<path d="M15 12h18v6l-2 21a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4l-2-21z"/><path d="M17 12V7M21 12V7M25 12V7M29 12V7M31 12V7"/><rect x="22" y="22" width="4" height="8" rx="2"/>',
  esmalte: '<rect x="20" y="5" width="8" height="12" rx="1"/><path d="M18 17h12v5H18zM14 22h20a2 2 0 0 1 2 2v15a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5V24a2 2 0 0 1 2-2z"/><path d="M24 36c-5-3-7-5-7-7a3 3 0 0 1 7-1 3 3 0 0 1 7 1c0 2-2 4-7 7z"/>',
  lixa: '<rect x="19" y="4" width="10" height="40" rx="5"/><path d="M24 10v28" stroke-dasharray="2 3"/>',
  alicate: '<path d="M21 5c0 6 1 9 3 11 2-2 3-5 3-11"/><path d="M22 15c-6 7-8 16-8 28M26 15c6 7 8 16 8 28M17 30c5 2 9 2 14 0"/>',
  separador: '<path d="M5 33v-8q3-7 6 0 3-7 6 0 3-7 6 0 3-7 6 0 3-7 6 0 3-7 6 0 3-7 6 0v8z"/><circle cx="11" cy="29" r="1.5"/><circle cx="23" cy="29" r="1.5"/><circle cx="35" cy="29" r="1.5"/>',
  batom: '<path d="M16 27h16v16H16zM18 19h12v8H18zM19 19v-8l10-6v14"/>',
  espelho: '<circle cx="24" cy="18" r="12"/><path d="M24 30v14M19 13a7 7 0 0 1 6-3"/>',
  secador: '<circle cx="28" cy="20" r="11"/><circle cx="28" cy="20" r="4"/><path d="M17 15H7v10h10M25 31l-3 12h6l3-11"/>',
  escova: '<rect x="18" y="4" width="12" height="22" rx="3"/><path d="M14 8h4M14 13h4M14 18h4M14 23h4M30 8h4M30 13h4M30 18h4M30 23h4M24 26v18"/>',
  borrifador: '<path d="M16 21h14v19a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4zM19 15h8v6h-8zM16 9h15v6H16zM31 11h5"/><path d="M40 8h.1M40 12h.1M42 10h.1"/>',
  folha: '<path d="M9 39C9 19 23 9 40 9c0 18-11 30-31 30z"/><path d="M9 39 28 20"/>',
  gota: '<path d="M24 6S12 20 12 29a12 12 0 0 0 24 0c0-9-12-23-12-23z"/><path d="M18 30a6 6 0 0 0 6 6"/>',
  pote: '<rect x="10" y="14" width="28" height="7" rx="2"/><path d="M12 21h24v14a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5z"/><path d="M18 30h12"/>',
  vela: '<path d="M16 21h16v21H16z"/><path d="M24 7c4 4 4 8 0 10-4-2-4-6 0-10zM24 17v4"/>',
  pedras: '<ellipse cx="24" cy="38" rx="15" ry="5"/><ellipse cx="24" cy="27" rx="10" ry="4.5"/><ellipse cx="24" cy="18" rx="6" ry="3.5"/>',
  lotus: '<path d="M24 38c-6-6-6-16 0-24 6 8 6 18 0 24zM24 38c-8 0-14-6-16-14 8 0 14 6 16 14zM24 38c8 0 14-6 16-14-8 0-14 6-16 14z"/>',
  dermografo: '<rect x="8" y="17" width="8" height="15" rx="2"/><rect x="18" y="17" width="8" height="15" rx="2"/><path d="M6 11h24v6H6zM29 17h4v22h-4zM31 39v6"/>',
  tinta: '<path d="M18 11h12v7H18zM14 18h20v21a5 5 0 0 1-5 5H19a5 5 0 0 1-5-5z"/><path d="M24 25s-4 5-4 8a4 4 0 0 0 8 0c0-3-4-8-4-8z"/>',
  ancora: '<circle cx="24" cy="9" r="4"/><path d="M24 13v29M16 20h16M8 30c2 8 8 12 16 12s14-4 16-12M5 33l3-3 3 3M37 33l3-3 3 3"/>',
  estrela: '<path d="m24 5 5.6 12.2 13.4 1.5-10 9 2.8 13.2L24 34.1l-11.8 6.8L15 27.7l-10-9 13.4-1.5z"/>',
  coracao: '<path d="M24 40C10 30 6 22 6 16a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 6-4 14-18 24z"/>',
  raio: '<path d="M28 4 12 26h10l-4 18 18-24H26z"/>',
  rosa: '<path d="M24 14c-6 0-8 6-4 9s10 0 9-5c-1-6-10-7-14-1-4 6 0 14 9 14s13-9 9-16"/><path d="M24 31v13M24 38c4-4 8-4 10-2-2 4-6 4-10 2z"/>',
  halter: '<path d="M14 24h20"/><rect x="8" y="14" width="6" height="20" rx="2"/><rect x="34" y="14" width="6" height="20" rx="2"/><rect x="4" y="18" width="4" height="12" rx="1"/><rect x="40" y="18" width="4" height="12" rx="1"/>',
  kettlebell: '<circle cx="24" cy="30" r="12"/><path d="M17 21c-2-12 16-12 14 0"/>',
  cronometro: '<circle cx="24" cy="27" r="15"/><path d="M24 27l6-6M20 6h8M24 6v6M37 14l3-3"/>',
  garrafa: '<path d="M20 4h8v6h-8zM18 10h12l2 6v24a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4V16z"/><path d="M16 24h16"/>',
  pulso: '<path d="M4 26h10l4-10 6 20 5-14 3 4h12"/>',
  anilha: '<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="5"/><circle cx="24" cy="24" r="11" stroke-dasharray="3 4"/>',
  calendario: '<rect x="8" y="10" width="32" height="30" rx="4"/><path d="M8 18h32M16 6v8M32 6v8M17 29l5 5 9-10"/>',
  relogio: '<circle cx="24" cy="24" r="16"/><path d="M24 14v10l7 4"/>',
  brilho: '<path d="M24 6c1 9 4 12 13 13-9 1-12 4-13 13-1-9-4-12-13-13 9-1 12-4 13-13z"/><path d="M38 32c.4 3 1.6 4.6 5 5-3.4.4-4.6 2-5 5-.4-3-1.6-4.6-5-5 3.4-.4 4.6-2 5-5z"/>',
  local: '<path d="M24 44c-8-10-14-17-14-24a14 14 0 0 1 28 0c0 7-6 14-14 24z"/><circle cx="24" cy="20" r="5"/>',
};

const SETS: Record<PatternNiche, string[]> = {
  barbearia: ["tesoura", "pente", "navalha", "poste", "bigode", "pincel", "maquina"],
  unhas: ["esmalte", "lixa", "alicate", "separador", "tesoura", "esmalte", "coracao"],
  cabelo: ["secador", "tesoura", "escova", "borrifador", "pente", "espelho", "batom"],
  estetica: ["folha", "gota", "pote", "vela", "pedras", "lotus", "brilho"],
  tatuagem: ["dermografo", "tinta", "rosa", "ancora", "estrela", "coracao", "raio"],
  fitness: ["halter", "kettlebell", "cronometro", "garrafa", "pulso", "anilha", "raio"],
  geral: ["calendario", "relogio", "brilho", "coracao", "local", "estrela", "calendario"],
};

const P = (niche: PatternNiche, key: string, label: string, ground: string, ink: string[], tone: "light" | "dark"): Pattern =>
  ({ id: `e-${niche}-${key}`, niche, label, ground, ink, tone });

export const PATTERNS: Pattern[] = [
  P("barbearia", "claro", "Barbearia clara", "#f6f4ef", ["#1d1d1f"], "light"),
  P("barbearia", "lousa", "Barbearia lousa", "#2b2b2d", ["#ecebe6"], "dark"),
  P("barbearia", "couro", "Barbearia couro", "#18120d", ["#c99a4a"], "dark"),
  P("unhas", "rosa", "Unhas rosa", "#fbf8f3", ["#d6336c", "#ec8fb3", "#8e3a59"], "light"),
  P("unhas", "nude", "Unhas nude", "#f5dfd8", ["#a94d66", "#d98c9c"], "light"),
  P("unhas", "noite", "Unhas noite", "#26141d", ["#f3b6cc", "#e05b8b"], "dark"),
  P("cabelo", "champagne", "Salão champagne", "#f6efe8", ["#9a4558", "#c39a6b"], "light"),
  P("cabelo", "blush", "Salão blush", "#f8e3e8", ["#8c3b52"], "light"),
  P("cabelo", "noite", "Salão noite", "#1d1517", ["#e6c9a6", "#c97d8e"], "dark"),
  P("estetica", "menta", "Estética menta", "#f1f8f5", ["#2f8f7a", "#8cc7b6"], "light"),
  P("estetica", "lavanda", "Estética lavanda", "#f0ebf7", ["#7a5aa6", "#b49ad6"], "light"),
  P("estetica", "noite", "Estética noite", "#11201c", ["#a6dccb"], "dark"),
  P("tatuagem", "neon", "Tatuagem neon", "#0d0d10", ["#ff4d78", "#e9e9ec"], "dark"),
  P("tatuagem", "flash", "Tatuagem flash", "#f3efe6", ["#151515", "#c8323c"], "light"),
  P("tatuagem", "brasa", "Tatuagem brasa", "#1a0b0e", ["#ff7a59"], "dark"),
  P("fitness", "lima", "Treino lima", "#0d1411", ["#c8f03c"], "dark"),
  P("fitness", "claro", "Treino claro", "#f1f3ef", ["#121212", "#3f7d3a"], "light"),
  P("fitness", "laranja", "Treino laranja", "#111827", ["#f97316", "#e5e7eb"], "dark"),
  P("geral", "violeta", "Geral violeta", "#f7f6fc", ["#7c3aed", "#c4b5fd"], "light"),
  P("geral", "noite", "Geral noite", "#121019", ["#a48bff"], "dark"),
  P("geral", "menta", "Geral menta", "#eefaf5", ["#0f766e", "#5eb8a8"], "light"),
];

const BY_ID = new Map(PATTERNS.map((p) => [p.id, p]));
export const findPattern = (id: string | null | undefined) => (id && BY_ID.get(id)) || null;

// Mosaico 500×500 em grade 5×5 com linhas alternadas deslocadas, giro e tamanho variados para parecer solto.
// Ícones que passam da borda ganham cópia do outro lado, então o mosaico emenda sem costura.
const TILE = 500;
const SLOTS = Array.from({ length: 25 }, (_, i) => {
  const col = i % 5, row = Math.floor(i / 5);
  const jx = [0, 14, -10, 8, -14, 12, -6, 4][(i * 3) % 8];
  const jy = [6, -12, 10, -4, 14, -8, 0, 12][(i * 5) % 8];
  return {
    cx: col * 100 + 50 + (row % 2 ? 50 : 0) + jx,
    cy: row * 100 + 50 + jy,
    rot: [-32, 18, -10, 38, -22, 8, 28, -40, 0][(i * 4) % 9],
    scale: [1.3, 1.15, 1.4, 1.2, 1.35][(i * 2) % 5],
  };
});

/** Mosaico da estampa como data URI de SVG, para usar em background-image */
export function patternDataUri(p: Pattern): string {
  const icons = SETS[p.niche];
  const uses = SLOTS.flatMap((s, i) => {
    const icon = ICONS[icons[i % icons.length]];
    const color = p.ink[(i * 2 + Math.floor(i / 5)) % p.ink.length];
    const reach = 24 * s.scale * 1.42;
    const xs = [0, ...(s.cx - reach < 0 ? [TILE] : []), ...(s.cx + reach > TILE ? [-TILE] : [])];
    const ys = [0, ...(s.cy - reach < 0 ? [TILE] : []), ...(s.cy + reach > TILE ? [-TILE] : [])];
    return xs.flatMap((dx) => ys.map((dy) =>
      `<g transform="translate(${s.cx + dx} ${s.cy + dy}) rotate(${s.rot}) scale(${s.scale}) translate(-24 -24)" stroke="${color}">${icon}</g>`));
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}"><rect width="${TILE}" height="${TILE}" fill="${p.ground}"/><g fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${uses}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
