import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "@/lib/theme";
import { ManageBooking, type BookingInfo } from "./manage";

export const metadata: Metadata = { title: "Minha reserva", robots: { index: false } };

export default async function ReservaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_booking_by_token", { p_token: token });
  if (!data) notFound();
  const info = data as BookingInfo;
  const theme = resolveTheme(info.business.theme);
  return (
    <main className="relative isolate min-h-dvh" style={{ backgroundColor: theme.ground, color: theme.text, textShadow: theme.halo }}>
      {theme.backdrop && <div aria-hidden="true" className="fixed inset-0 -z-10" style={theme.backdrop} />}
      <div className="mx-auto max-w-lg px-4 py-10">
        <ManageBooking token={token} info={info} theme={theme} />
      </div>
    </main>
  );
}
