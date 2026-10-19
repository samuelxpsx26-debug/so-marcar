import type { ThemeStyle, resolveTheme } from "@/lib/theme";
export type PublicService = { id: string; name: string; description: string | null; duration_minutes: number; price_cents: number };
export type PublicPro = { id: string; name: string; bio: string | null; avatar_url: string | null; service_ids: string[] };
export type PublicBusiness = {
  id: string; name: string; slug: string; segment: string; description: string | null; timezone: string;
  whatsapp: string | null; phone: string | null; address: { text?: string } | null;
  theme: { primary?: string; background?: string; image?: string | null; logo?: string | null; style?: ThemeStyle };
  cancellation_policy: string | null; max_days_ahead: number; cancel_notice_minutes: number; active: boolean;
  services: PublicService[]; professionals: PublicPro[];
};
export type Slot = { professional_id: string; professional_name: string; starts_at: string };
export type ResolvedTheme = ReturnType<typeof resolveTheme>;
