export function slugify(input: string): string {
  return input
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "auth", "entrar", "cadastrar", "comecar", "painel", "reserva", "precos",
  "termos", "privacidade", "ajuda", "suporte", "blog", "login", "logout", "offline", "manifest", "sw",
]);

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/.test(slug) && !RESERVED_SLUGS.has(slug);
}
