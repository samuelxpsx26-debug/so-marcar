import Link from "next/link";
import { Logo } from "@/components/logo";

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "samuelxpsx26@gmail.com";
export const LEGAL_UPDATED = "18 de outubro de 2026";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/"><Logo /></Link>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">Atualizado em {LEGAL_UPDATED}</p>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
      <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
        <Link className="underline" href="/privacidade">Privacidade</Link> · <Link className="underline" href="/termos">Termos de uso</Link> · <Link className="underline" href="/">Início</Link>
      </p>
    </main>
  );
}
