/** Pede ao servidor para enviar agora o e-mail de confirmação. Falha em silêncio: o cron tenta de novo. */
export function notify(token: string) {
  fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), keepalive: true }).catch(() => {});
}
