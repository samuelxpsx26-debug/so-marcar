import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Endereço oficial. Em produção, quem chega pelo *.vercel.app é levado para ele
// (assim o painel, os links copiados e o login ficam sempre no domínio próprio).
const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

function toOfficialDomain(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production" || !SITE?.startsWith("https://")) return null;
  const host = request.headers.get("host") ?? "";
  if (!host.endsWith(".vercel.app")) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const { pathname, search } = request.nextUrl;
  // APIs (webhooks, cron) e a volta do login continuam respondendo no endereço antigo
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) return null;
  return NextResponse.redirect(`${SITE}${pathname}${search}`, 308);
}

export async function proxy(request: NextRequest) {
  return toOfficialDomain(request) ?? updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|webp|mp4)$).*)"],
};
