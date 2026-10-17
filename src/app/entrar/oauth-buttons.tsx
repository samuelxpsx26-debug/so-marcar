"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "facebook" | "apple";
const LABELS: Record<Provider, string> = { google: "Continuar com Google", facebook: "Continuar com Facebook", apple: "Continuar com Apple" };

const enabled = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "google").split(",").map((s) => s.trim()).filter((s): s is Provider => s in LABELS);

function Icon({ p }: { p: Provider }) {
  if (p === "google") return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z"/></svg>
  );
  if (p === "facebook") return <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>;
  return <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>;
}

export function OAuthButtons({ next }: { next: string }) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(provider: Provider) {
    setBusy(provider);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError("Não foi possível abrir o login agora. Tente com e-mail.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {enabled.map((p) => (
        <button key={p} type="button" onClick={() => go(p)} disabled={busy !== null} className="btn btn-ghost w-full py-3.5">
          <Icon p={p} /> {busy === p ? "Abrindo…" : LABELS[p]}
        </button>
      ))}
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
