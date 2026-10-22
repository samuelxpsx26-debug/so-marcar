"use server";
import { createClient } from "@/lib/supabase/server";

/** Marca o último acesso do usuário (o banco só grava se passou de 2 minutos). Falha em silêncio. */
export async function ping() {
  const supabase = await createClient();
  await supabase.rpc("touch_last_seen");
}
