"use client";
import { useTransition } from "react";
import { markWaitlistBooked, markWaitlistNotified, removeWaitlistEntry } from "./actions";

/** WhatsApp (marca como avisado quando há vaga), "Já marcou" e "Remover" */
export function EntryActions({ id, wa, notify }: { id: string; wa: string; notify: boolean }) {
  const [pending, start] = useTransition();
  return (
    <>
      <a href={wa} target="_blank" onClick={() => { if (notify) start(() => void markWaitlistNotified(id)); }}
        className="btn flex-1 bg-[#25D366] px-3 py-2 text-xs text-white sm:flex-none">{notify ? <>Avisar<span className="hidden sm:inline">&nbsp;no WhatsApp</span></> : "WhatsApp"}</a>
      <button type="button" disabled={pending} onClick={() => start(() => void markWaitlistBooked(id))} className="btn btn-ghost px-3 py-2 text-xs">Já marcou</button>
      <button type="button" disabled={pending} onClick={() => { if (confirm("Tirar esta pessoa da lista de espera?")) start(() => void removeWaitlistEntry(id)); }}
        aria-label="Remover da lista" title="Remover da lista" className="btn btn-ghost px-3 py-2 text-xs text-bad">✕</button>
    </>
  );
}
