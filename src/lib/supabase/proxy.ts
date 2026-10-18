import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/env";

const PROTECTED = ["/painel", "/comecar", "/admin"];

export async function updateSession(request: NextRequest) {
  // Se o Supabase devolver o login para outra página (ex.: a inicial), leva o código para o callback
  const sp = request.nextUrl.searchParams;
  if (request.nextUrl.pathname !== "/auth/callback" && (sp.has("code") || sp.has("error_description"))) {
    const url = request.nextUrl.clone();
    url.pathname = sp.has("code") ? "/auth/callback" : "/entrar";
    url.search = sp.has("code") ? `?code=${encodeURIComponent(sp.get("code")!)}&next=/painel` : "?erro=1";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  if (!supabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}
