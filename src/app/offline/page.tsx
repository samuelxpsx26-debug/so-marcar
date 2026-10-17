import { Logo } from "@/components/logo";

export const metadata = { title: "Sem conexão" };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 text-center">
      <Logo />
      <h1 className="mt-6 text-2xl font-bold">Você está sem internet</h1>
      <p className="mt-2 text-muted">Assim que a conexão voltar, sua agenda aparece de novo. Nenhum dado foi perdido.</p>
    </main>
  );
}
