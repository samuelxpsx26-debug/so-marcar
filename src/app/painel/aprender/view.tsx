"use client";
import { useActionState, useSyncExternalStore } from "react";
import { SubmitButton } from "@/components/submit-button";
import { openTutorial, readWatched } from "@/components/tutorial-modal";
import { posterSrc, TOPICS, TUTORIALS } from "@/lib/tutorials";
import { sendSuggestion, type R } from "./actions";

const subscribe = (cb: () => void) => {
  window.addEventListener("somarcar:tutorial-visto", cb);
  return () => window.removeEventListener("somarcar:tutorial-visto", cb);
};

export function LearnView() {
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(readWatched()), () => "[]");
  const watched: string[] = JSON.parse(raw);
  const done = TUTORIALS.filter((t) => watched.includes(t.id)).length;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">Seu progresso</span><span className="text-muted">{done} de {TUTORIALS.length} vistos</span></div>
        <div className="mt-2 h-2.5 rounded-full bg-zinc-100"><div className="h-2.5 rounded-full bg-brand" style={{ width: `${Math.max(3, (done / TUTORIALS.length) * 100)}%` }} /></div>
      </div>
      {TOPICS.map((topic) => (
        <section key={topic} className="space-y-3">
          <h2 className="font-bold">{topic}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {TUTORIALS.filter((t) => t.topic === topic).map((t) => {
              const seen = watched.includes(t.id);
              return (
                <button key={t.id} type="button" onClick={() => openTutorial(t.id)} className="card flex items-center gap-3 p-3 text-left transition hover:border-brand">
                  {t.seconds ? (
                    <span className="relative h-20 w-[45px] shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={posterSrc(t)} alt="" className="h-full w-full object-cover opacity-80" />
                      <span className="absolute inset-0 grid place-items-center text-lg text-white">▶</span>
                    </span>
                  ) : (
                    <span className="grid h-20 w-[45px] shrink-0 place-items-center rounded-lg bg-brand/10 text-xl text-brand">☰</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">{t.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{t.summary}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">{t.seconds ? `Vídeo de ${t.seconds}s` : "Passo a passo"}</span>
                      {seen && <span className="font-semibold text-emerald-600">✓ Visto</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function SuggestionBox() {
  const [state, action] = useActionState<R, FormData>(sendSuggestion, {});
  return (
    <section className="card space-y-3" id="sugestoes">
      <div>
        <h2 className="font-bold">Tem uma ideia ou sentiu falta de algo?</h2>
        <p className="text-sm text-muted">Mande sua sugestão. Ela chega direto para quem faz o Só Marcar.</p>
      </div>
      <form action={action} className="space-y-3">
        <textarea name="body" rows={4} maxLength={1000} required minLength={5}
          placeholder="Ex.: queria poder mandar lembrete automático um dia antes" className="field resize-y" />
        {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-bad">{state.error}</p>}
        {state.ok && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Recebido! Obrigado pela sugestão.</p>}
        <SubmitButton className="btn btn-primary w-full sm:w-auto">Enviar sugestão</SubmitButton>
      </form>
    </section>
  );
}
