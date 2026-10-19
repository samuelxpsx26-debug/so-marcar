import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "@/lib/theme";
import type { Segment } from "@/lib/segments";
import { RESERVED_SLUGS } from "@/lib/slug";
import { waLink } from "@/lib/format";
import { BookingFlow } from "@/components/booking/booking-flow";
import { brandFonts } from "@/components/brand-fonts";
import type { PublicBusiness } from "@/components/booking/types";

const load = cache(async (slug: string) => {
  if (RESERVED_SLUGS.has(slug) || !/^[a-z0-9-]{3,48}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_business", { p_slug: slug });
  return (data as PublicBusiness | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = await load((await params).slug);
  if (!b) return { title: "Página não encontrada" };
  return { title: `Agendar · ${b.name}`, description: b.description ?? `Agende seu horário em ${b.name} em poucos toques.`, robots: { index: true } };
}

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = await load((await params).slug);
  if (!b) notFound();
  const theme = resolveTheme(b.theme, b.segment as Segment);

  return (
    <main className={`${brandFonts} relative isolate min-h-dvh`} style={{ backgroundColor: theme.photo ? "#0b0b0d" : theme.background, backgroundImage: theme.photo ? undefined : theme.backgroundImage, color: theme.text, fontFamily: "var(--font-manrope), system-ui, sans-serif" }}>
      {theme.backdrop && <div aria-hidden="true" className="fixed inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: theme.backdrop }} />}
      <div className="mx-auto max-w-lg px-4 pb-16 pt-4">
        <header className="mb-8">
          <div className="relative flex min-h-48 flex-col justify-end overflow-hidden rounded-3xl p-5 text-white shadow-xl" style={{ backgroundImage: theme.cover, backgroundSize: "cover", backgroundPosition: "center" }}>
            {theme.logo
              ? <img src={theme.logo} alt={`Logo de ${b.name}`} className="mb-3 h-16 w-16 rounded-2xl bg-white object-contain shadow-lg" />
              : <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl text-2xl font-extrabold shadow-lg" style={{ background: theme.primary, color: theme.onPrimary }}>{b.name.slice(0, 1).toUpperCase()}</div>}
            <h1 className="text-4xl leading-none" style={{ fontFamily: theme.display.family, fontWeight: theme.display.weight, fontStyle: theme.display.style, textTransform: theme.display.transform, letterSpacing: theme.display.tracking }}>{b.name}</h1>
          </div>
          {b.description && <p className="mt-4 opacity-80">{b.description}</p>}
          {(b.address?.text || b.whatsapp) && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm opacity-80">
              {b.address?.text && (
                <span className="inline-flex items-center gap-1.5">
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                  {b.address.text}
                </span>
              )}
              {b.whatsapp && <a href={waLink(b.whatsapp, "Oi! Tenho uma dúvida.")} target="_blank" rel="noopener" className="underline">Falar no WhatsApp</a>}
            </div>
          )}
        </header>
        <BookingFlow b={b} theme={theme} />
        <footer className="mt-16 text-center text-xs opacity-50">
          Agendamento por <Link href="/" className="underline">Só Marcar</Link> · crie a agenda do seu negócio grátis
        </footer>
      </div>
    </main>
  );
}
