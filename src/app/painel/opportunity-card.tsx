"use client";
import Link from "next/link";
import { useState } from "react";
import { brl, waLink } from "@/lib/format";
import type { Opportunity } from "@/lib/opportunities";

const accent: Record<Opportunity["kind"], string> = {
  fill_slots: "bg-emerald-500",
  win_back: "bg-violet-500",
  confirm_tomorrow: "bg-sky-500",
  close_out: "bg-amber-500",
  trial: "bg-rose-500",
};

export function OpportunityCard({ o }: { o: Opportunity }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const contacts = o.contacts ?? [];

  return (
    <div className="card relative overflow-hidden">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${accent[o.kind]}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{o.title}</h3>
          <p className="mt-1 text-sm text-muted">{o.detail}</p>
        </div>
        {o.valueCents > 0 && <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-good">até {brl(o.valueCents)}</span>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {contacts.length > 0 && (
          <button onClick={() => setOpen(!open)} className="btn btn-primary px-3 py-2 text-xs">{open ? "Fechar" : `Chamar ${contacts.length} no WhatsApp`}</button>
        )}
        {o.href && (o.href.startsWith("/") ? <Link href={o.href} className="btn btn-ghost px-3 py-2 text-xs">Resolver</Link>
          : <a href={o.href} target="_blank" className="btn btn-ghost px-3 py-2 text-xs">Abrir meu link</a>)}
      </div>
      {open && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {contacts.map((c) => (
            <li key={c.phone} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <span className={`truncate ${done.has(c.phone) ? "text-muted line-through" : ""}`}>{c.name}</span>
              <a
                href={waLink(c.phone, c.message)}
                target="_blank"
                onClick={() => setDone(new Set(done).add(c.phone))}
                className="shrink-0 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white"
              >
                {done.has(c.phone) ? "Enviado" : "Enviar"}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
