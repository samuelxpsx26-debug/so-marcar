import type { Metadata } from "next";
import { headers } from "next/headers";
import { getContext } from "@/lib/business";
import { addDays, localDate } from "@/lib/format";
import { loadWaitlist } from "@/lib/waitlist";
import { EsperaView } from "./view";

export const metadata: Metadata = { title: "Lista de espera" };

export default async function EsperaPage() {
  const { supabase, business } = await getContext();
  const today = localDate(new Date(), business.timezone);
  const tomorrow = addDays(today, 1);
  const h = await headers();
  const bookingUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/${business.slug}`;
  const { entries, open } = await loadWaitlist(supabase, business, today);
  return <EsperaView business={business} entries={entries} open={open} bookingUrl={bookingUrl} today={today} tomorrow={tomorrow} />;
}
