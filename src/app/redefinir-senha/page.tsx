"use client";
import { useActionState } from "react";
import { Logo } from "@/components/logo";
import { SubmitButton } from "@/components/submit-button";
import { updatePassword, type AuthState } from "../entrar/actions";

export default function RedefinirSenha() {
  const [state, action] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <Logo />
      <h1 className="mt-8 text-2xl font-bold">Crie uma nova senha</h1>
      <form action={action} className="mt-6 space-y-4">
        <div><label className="label" htmlFor="password">Nova senha</label><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" className="field" required /></div>
        {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        <SubmitButton>Salvar senha</SubmitButton>
      </form>
    </main>
  );
}
