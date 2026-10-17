import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Só Marcar",
    short_name: "Só Marcar",
    description: "Agenda online, lembretes e recuperação de clientes.",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#7c3aed",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
