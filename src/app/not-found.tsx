import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 text-center">
      <Logo />
      <h1 className="mt-6 text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-muted">Confira o link com quem te enviou.</p>
      <Link href="/" className="btn btn-primary mt-6">Ir para o início</Link>
    </main>
  );
}
