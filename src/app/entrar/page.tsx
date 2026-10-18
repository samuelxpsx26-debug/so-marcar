import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { AuthForms } from "./auth-forms";
import { OAuthButtons } from "./oauth-buttons";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ modo?: string; next?: string; erro?: string }> }) {
  const sp = await searchParams;
  const mode = sp.modo === "cadastro" ? "signup" : sp.modo === "esqueci" ? "forgot" : "signin";
  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : mode === "signup" ? "/comecar" : "/painel";

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col px-4 py-6 sm:px-10">
        <Link href="/"><Logo /></Link>
        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === "signup" ? "Comece seu mês grátis" : mode === "forgot" ? "Recuperar senha" : "Bem-vindo de volta"}
          </h1>
          <p className="mt-2 text-muted">
            {mode === "signup" ? "Leva menos de 2 minutos. Sem cartão." : mode === "forgot" ? "Enviaremos um link para criar uma nova senha." : "Entre para ver sua agenda de hoje."}
          </p>
          {sp.erro && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-bad">Não foi possível concluir o login. Tente de novo.</p>}
          {mode !== "forgot" && process.env.NEXT_PUBLIC_AUTH_PROVIDERS && (
            <div className="mt-8">
              <OAuthButtons next={next} />
              <div className="my-6 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />ou com e-mail<span className="h-px flex-1 bg-line" /></div>
            </div>
          )}
          <div className={mode === "forgot" || !process.env.NEXT_PUBLIC_AUTH_PROVIDERS ? "mt-8" : ""}>
            <AuthForms mode={mode} next={next} />
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            {mode === "signup" ? (<>Já tem conta? <Link className="font-semibold text-brand" href="/entrar">Entrar</Link></>)
              : (<>Ainda não usa? <Link className="font-semibold text-brand" href="/entrar?modo=cadastro">Teste grátis por 30 dias</Link></>)}
          </p>
        </div>
      </section>
      <aside className="relative hidden overflow-hidden bg-zinc-950 p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-violet-600/40 blur-3xl" />
        <p className="relative max-w-md text-3xl font-semibold leading-tight">“Toda manhã eu abro e já sei quem chamar. A agenda parou de ter buraco.”</p>
        <p className="relative mt-4 text-zinc-400">É isso que o Oportunidades de Hoje entrega.</p>
      </aside>
    </main>
  );
}
