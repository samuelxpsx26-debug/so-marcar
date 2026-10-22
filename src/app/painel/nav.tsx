"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const allItems: { href: string; label: string; icon: string; owner?: boolean }[] = [
  { href: "/painel", label: "Hoje", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/painel/agenda", label: "Agenda", icon: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" },
  { href: "/painel/clientes", label: "Clientes", icon: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
  { href: "/painel/espera", label: "Lista de espera", icon: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" },
  { href: "/painel/campanhas", label: "Campanhas", icon: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" },
  { href: "/painel/financeiro", label: "Financeiro", icon: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", owner: true },
  { href: "/painel/relatorios", label: "Relatórios", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/painel/servicos", label: "Serviços", icon: "M4 7h16M4 12h16M4 17h10" },
  { href: "/painel/equipe", label: "Equipe", icon: "M17 20v-1a4 4 0 0 0-3-3.9M7 20v-1a4 4 0 0 1 8 0M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 11a2.5 2.5 0 1 0 0-5" },
  { href: "/painel/aparencia", label: "Aparência", icon: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1-.8-1.2-.8-2 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01" },
  { href: "/painel/aprender", label: "Aprender", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8.5v7l6-3.5z" },
  { href: "/painel/ajustes", label: "Ajustes", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.3H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 5.1V5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z" },
];

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}

const itemsFor = (owner: boolean) => allItems.filter((i) => owner || !i.owner);

export function SideNav({ owner = false }: { owner?: boolean }) {
  const path = usePathname();
  const items = itemsFor(owner);
  return (
    <nav className="space-y-1">
      {items.map((i) => {
        const active = i.href === "/painel" ? path === "/painel" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${active ? "bg-brand/10 text-brand" : "text-zinc-600 hover:bg-zinc-100"}`}>
            <Icon d={i.icon} /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

const MAIN = ["/painel", "/painel/agenda", "/painel/clientes", "/painel/servicos"];

/** Barra do celular: 4 atalhos + "Mais" com o resto do menu */
export function BottomNav({ owner = false }: { owner?: boolean }) {
  const path = usePathname();
  const items = itemsFor(owner);
  const [open, setOpen] = useState(false);
  const main = items.filter((i) => MAIN.includes(i.href));
  const more = items.filter((i) => !MAIN.includes(i.href));
  const isActive = (href: string) => (href === "/painel" ? path === "/painel" : path.startsWith(href));
  const moreActive = more.some((i) => isActive(i.href));
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)}>
          <nav className="absolute inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {more.map((i) => (
              <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-3 text-center text-xs font-medium ${isActive(i.href) ? "bg-brand/10 text-brand" : "text-zinc-600"}`}>
                <Icon d={i.icon} /> {i.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {main.map((i) => (
          <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive(i.href) ? "text-brand" : "text-zinc-500"}`}>
            <Icon d={i.icon} /> {i.label}
          </Link>
        ))}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${open || moreActive ? "text-brand" : "text-zinc-500"}`}>
          <Icon d="M4 6h16M4 12h16M4 18h16" /> Mais
        </button>
      </nav>
    </>
  );
}
