import Link from "next/link";
import { Logo } from "@/components/logo";
import { getContext } from "@/lib/business";
import { BottomNav, SideNav } from "./nav";
import { CopyLink } from "./copy-link";
import { Presence } from "./presence";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { business, email, role } = await getContext();
  const owner = role === "owner";
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface p-4 lg:flex">
        <Link href="/painel"><Logo /></Link>
        <div className="mt-6 rounded-xl bg-zinc-50 p-3">
          <p className="truncate text-sm font-semibold">{business.name}</p>
          <CopyLink slug={business.slug} />
        </div>
        <div className="mt-6 flex-1"><SideNav owner={owner} /></div>
        <form action="/sair" method="post" className="border-t border-line pt-3">
          <p className="truncate px-1 text-xs text-muted">{email}</p>
          <button className="mt-1 px-1 text-sm text-muted hover:text-ink">Sair</button>
        </form>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <span className="truncate font-semibold">{business.name}</span>
          <CopyLink slug={business.slug} compact />
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>
      </div>
      <BottomNav owner={owner} />
      <Presence />
    </div>
  );
}
