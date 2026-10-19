import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { SEGMENTS, type Segment } from "@/lib/segments";
import { Logo } from "@/components/logo";
import { OnboardForm } from "./onboard-form";

export const metadata: Metadata = { title: "Configurar meu negócio" };

export default async function ComecarPage() {
  const host = (await headers()).get("host") ?? "somarcar.app";
  // Nicho escolhido na página inicial (cookie sm_nicho) já vem marcado
  const nicho = (await cookies()).get("sm_nicho")?.value;
  const defaultSegment: Segment = nicho && nicho in SEGMENTS ? (nicho as Segment) : "barbearia";
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Logo />
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Vamos montar sua agenda</h1>
      <p className="mt-2 text-muted">Três respostas e seu link de agendamento já fica no ar. Dá para mudar tudo depois.</p>
      <OnboardForm host={host} defaultSegment={defaultSegment} />
    </main>
  );
}
