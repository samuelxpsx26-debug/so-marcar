/** Nome e WhatsApp do cliente guardados no próprio aparelho, para não redigitar na próxima reserva */
export type RememberedCustomer = { name: string; phone: string; email?: string };

const KEY = "somarcar:cliente";

export function loadCustomer(): RememberedCustomer | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.name === "string" && typeof v.phone === "string" ? v : null;
  } catch {
    return null;
  }
}

export function saveCustomer(c: RememberedCustomer) {
  try { localStorage.setItem(KEY, JSON.stringify({ name: c.name.trim(), phone: c.phone.trim(), email: c.email?.trim() || undefined })); } catch {}
}

export function forgetCustomer() {
  try { localStorage.removeItem(KEY); } catch {}
}
