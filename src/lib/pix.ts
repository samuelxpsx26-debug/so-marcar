// Pix "copia e cola" estático (BR Code, padrão EMV do Banco Central).
// O dinheiro vai direto para a chave do próprio estabelecimento: o Só Marcar não intermedeia.

export type PixKeyType = "cpf" | "cnpj" | "telefone" | "email" | "aleatoria";

export const PIX_KEY_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF", cnpj: "CNPJ", telefone: "Celular", email: "E-mail", aleatoria: "Chave aleatória",
};

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Deixa a chave no formato que o Pix espera, ou null se for inválida */
export function normalizePixKey(type: PixKeyType, raw: string): string | null {
  const v = raw.trim();
  const digits = v.replace(/\D/g, "");
  switch (type) {
    case "cpf": return digits.length === 11 && validCpf(digits) ? digits : null;
    case "cnpj": return digits.length === 14 && validCnpj(digits) ? digits : null;
    case "telefone": {
      const d = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
      return /^55\d{10,11}$/.test(d) ? `+${d}` : null;
    }
    case "email": return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && v.length <= 77 ? v.toLowerCase() : null;
    case "aleatoria": return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v.toLowerCase() : null;
  }
}

function validCpf(d: string) {
  if (/^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function validCnpj(d: string) {
  if (/^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => {
    const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((acc, x, i) => acc + x * Number(d[i]), 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no campo 63 */
export function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Monta o Pix copia e cola com valor e identificador da reserva */
export function pixPayload({ key, name, city, amountCents, txid }: { key: string; name: string; city: string; amountCents?: number; txid?: string }) {
  const clean = (s: string, max: number) => strip(s).replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, max) || "NA";
  const tx = (txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const body = [
    field("00", "01"),
    field("26", field("00", "br.gov.bcb.pix") + field("01", key)),
    field("52", "0000"),
    field("53", "986"),
    amountCents ? field("54", (amountCents / 100).toFixed(2)) : "",
    field("58", "BR"),
    field("59", clean(name, 25)),
    field("60", clean(city, 15)),
    field("62", field("05", tx)),
    "6304",
  ].join("");
  return body + crc16(body);
}

/** Valor do sinal de um serviço conforme a regra do estabelecimento */
export function depositCents(mode: "off" | "percent" | "fixed", value: number, priceCents: number) {
  if (mode === "percent") return Math.min(priceCents, Math.round((priceCents * value) / 100));
  if (mode === "fixed") return Math.min(priceCents, value);
  return 0;
}
