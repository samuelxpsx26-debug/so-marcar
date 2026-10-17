import type { Metadata } from "next";
import { headers } from "next/headers";
import { Logo } from "@/components/logo";
import { OnboardForm } from "./onboard-form";

export const metadata: Metadata = { title: "Configurar meu negócio" };

export default async function ComecarPage() {
  const host = (await headers()).get("host") ?? "somarcar.app";
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Logo />
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Vamos montar sua agenda</h1>
      <p className="mt-2 text-muted">Três respostas e seu link de agendamento já fica no ar. Dá para mudar tudo depois.</p>
      <OnboardForm host={host} />
    </main>
  );
}
