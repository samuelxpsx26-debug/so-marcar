"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/painel", label: "Hoje", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/painel/agenda", label: "Agenda", icon: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" },
  { href: "/painel/clientes", label: "Clientes", icon: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
  { href: "/painel/servicos", label: "Serviços", icon: "M4 7h16M4 12h16M4 17h10" },
  { href: "/painel/equipe", label: "Equipe", icon: "M17 20v-1a4 4 0 0 0-3-3.9M7 20v-1a4 4 0 0 1 8 0M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 11a2.5 2.5 0 1 0 0-5" },
  { href: "/painel/aparencia", label: "Aparência", icon: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1-.8-1.2-.8-2 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01" },
  { href: "/painel/ajustes", label: "Ajustes", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.3H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 5.1V5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z" },
];

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}

export function SideNav() {
  const path = usePathname();
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

export function BottomNav() {
  const path = usePathname();
  const main = [items[0], items[1], items[2], items[3], items[6]];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {main.map((i) => {
        const active = i.href === "/painel" ? path === "/painel" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-brand" : "text-zinc-500"}`}>
            <Icon d={i.icon} /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
