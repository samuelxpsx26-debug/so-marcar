import type { ThemeStyle } from "./theme";

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

const ALL = Object.values(BACKDROPS).flat();

export function findBackdrop(id: string | null | undefined): Backdrop | null {
  return (id && ALL.find((b) => b.id === id)) || null;
}

export function backdropUrl(b: Backdrop, width = 1600): string {
  return `https://images.unsplash.com/${b.photo}?auto=format&fit=crop&w=${width}&q=60`;
}
