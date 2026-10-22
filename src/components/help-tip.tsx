"use client";
import { useEffect, useId, useRef, useState } from "react";
import { findTutorial } from "@/lib/tutorials";
import { openTutorial } from "./tutorial-modal";

/** Botão "?" pequeno ao lado de um título: abre uma explicação curta e fecha ao clicar fora.
 *  Com `tutorial`, mostra também um botão que abre o vídeo/passo a passo por cima da tela. */
export function HelpTip({ children, label = "O que é isso?", tutorial }: { children: React.ReactNode; label?: string; tutorial?: string }) {
  const t = tutorial ? findTutorial(tutorial) : null;
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const open = pos !== null;
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!box.current?.contains(e.target as Node)) setPos(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const hide = () => setPos(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide);
    };
  }, [open]);

  return (
    <span ref={box} className="relative ml-1.5 inline-flex align-middle">
      <button type="button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={(e) => {
          if (open) return setPos(null);
          // Caixa fixa na tela, centrada no botão mas sem sair pelas bordas (celular)
          const r = e.currentTarget.getBoundingClientRect();
          const width = Math.min(288, window.innerWidth - 16);
          const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, 8), window.innerWidth - width - 8);
          setPos({ top: r.bottom + 6, left, width });
        }}
        className={`grid h-[18px] w-[18px] place-items-center rounded-full border text-[11px] font-bold leading-none transition ${open ? "border-brand bg-brand text-white" : "border-line bg-white text-muted hover:border-brand hover:text-brand"}`}>
        ?
      </button>
      {pos && (
        <span id={id} role="note" style={pos} className="fixed z-50 rounded-xl border border-line bg-white p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-zinc-700 shadow-xl sm:w-72">
          {children}
          {t && (
            <button type="button" onClick={() => { setPos(null); openTutorial(t.id); }}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white">
              {t.seconds ? <>▶ Ver vídeo ({t.seconds}s)</> : "Ver passo a passo"}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
