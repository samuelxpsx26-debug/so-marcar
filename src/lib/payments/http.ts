import { ProviderError, type ServiceProviderId } from "./types";
import { timingSafeEqual } from "node:crypto";

export async function providerFetch<T>(provider: ServiceProviderId, url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", "User-Agent": "SoMarcar/1.0", ...init.headers } });
  const text = await res.text();
  // Mensagem curta, sem ecoar o corpo inteiro (pode ter dados do cliente)
  if (!res.ok) throw new ProviderError(provider, res.status, text.slice(0, 200));
  return (text ? JSON.parse(text) : {}) as T;
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const toCents = (v: number | null | undefined) => (typeof v === "number" ? Math.round(v * 100) : null);
export const onlyDigits = (s?: string | null) => (s ?? "").replace(/\D/g, "");
