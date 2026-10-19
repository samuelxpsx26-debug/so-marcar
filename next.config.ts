import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fotos chegam já reduzidas no navegador (até ~1 MB); folga para o envio pela server action
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
