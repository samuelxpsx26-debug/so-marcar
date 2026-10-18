import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { ProviderCredentials } from "./types";

// AES-256-GCM. A chave (32 bytes em base64) fica só na Vercel: PAYMENT_CREDENTIALS_KEY.
function key(raw = process.env.PAYMENT_CREDENTIALS_KEY): Buffer {
  const k = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (k.length !== 32) throw new Error("PAYMENT_CREDENTIALS_KEY ausente ou inválida (precisa de 32 bytes em base64)");
  return k;
}

export function encryptCredentials(creds: ProviderCredentials, rawKey?: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(rawKey), iv);
  const data = Buffer.concat([c.update(JSON.stringify(creds), "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decryptCredentials(payload: string, rawKey?: string): ProviderCredentials {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("credenciais em formato desconhecido");
  const d = createDecipheriv("aes-256-gcm", key(rawKey), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8"));
}
