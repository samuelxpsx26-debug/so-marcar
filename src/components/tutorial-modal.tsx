"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { findTutorial, posterSrc, videoSrc, WATCHED_KEY, type Tutorial } from "@/lib/tutorials";

const EVENT = "somarcar:tutorial";

/** Abre o tutorial por cima da tela atual, de qualquer lugar do painel */
export function openTutorial(id: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

export function readWatched(): string[] {
  try { return JSON.parse(localStorage.getItem(WATCHED_KEY) ?? "[]"); } catch { return []; }
}
function markWatched(id: string) {
  try {
    const list = readWatched();
    if (!list.includes(id)) localStorage.setItem(WATCHED_KEY, JSON.stringify([...list, id]));
    window.dispatchEvent(new Event("somarcar:tutorial-visto"));
  } catch { /* sem armazenamento: só não marca */ }
}

/** Fica no layout do painel e mostra o popup quando alguém pede um tutorial */
export function TutorialHost() {
  const [t, setT] = useState<Tutorial | null>(null);

  useEffect(() => {
    const open = (e: Event) => setT(findTutorial((e as CustomEvent<string>).detail));
    window.addEventListener(EVENT, open);
    return () => window.removeEventListener(EVENT, open);
  }, []);

  useEffect(() => {
    if (!t) return;
    if (!t.seconds) markWatched(t.id);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setT(null); };
    document.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = overflow; };
  }, [t]);

  if (!t) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setT(null)} role="dialog" aria-modal="true" aria-label={t.title}>
      <div className="max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-2xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">{t.topic}</p>
            <h2 className="text-lg font-bold leading-tight">{t.title}</h2>
          </div>
          <button type="button" onClick={() => setT(null)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-lg text-zinc-600">×</button>
        </div>
        {t.seconds && (
          <video key={t.id} src={videoSrc(t)} poster={posterSrc(t)} controls autoPlay playsInline onPlay={() => markWatched(t.id)}
            className="mx-auto mt-3 aspect-[9/16] max-h-[58dvh] w-auto rounded-2xl bg-black" />
        )}
        <ol className="mt-4 space-y-2.5 text-sm">
          {t.steps.map((s, i) => (
            <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">{i + 1}</span><span className="pt-0.5">{s}</span></li>
          ))}
        </ol>
        <Link href="/painel/aprender" onClick={() => setT(null)} className="mt-4 block text-center text-sm font-medium text-brand underline">Ver todos os tutoriais</Link>
      </div>
    </div>,
    document.body,
  );
}

/** Link de texto que abre um tutorial (para usar em páginas do servidor) */
export function TutorialLink({ id, children, className = "font-semibold text-brand underline" }: { id: string; children: React.ReactNode; className?: string }) {
  return <button type="button" onClick={() => openTutorial(id)} className={className}>{children}</button>;
}
