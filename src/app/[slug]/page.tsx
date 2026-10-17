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
    <main className="min-h-dvh" style={{ backgroundColor: theme.background, backgroundImage: theme.backgroundImage, backgroundSize: "cover", color: theme.text }}>
      <div className="mx-auto max-w-lg px-4 pb-16 pt-8">
        <header className="mb-8">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl text-2xl font-extrabold" style={{ background: theme.primary, color: theme.onPrimary }}>{b.name.slice(0, 1).toUpperCase()}</div>
          <h1 className="text-3xl font-extrabold tracking-tight">{b.name}</h1>
          {b.description && <p className="mt-2 opacity-80">{b.description}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-75">
            {b.address?.text && <span>📍 {b.address.text}</span>}
            {b.whatsapp && <a href={waLink(b.whatsapp, "Oi! Tenho uma dúvida.")} target="_blank" className="underline">WhatsApp</a>}
          </div>
        </header>
        <BookingFlow b={b} theme={theme} />
        <footer className="mt-16 text-center text-xs opacity-50">
          Agendamento por <Link href="/" className="underline">Só Marcar</Link> · crie a agenda do seu negócio grátis
        </footer>
      </div>
    </main>
  );
}
