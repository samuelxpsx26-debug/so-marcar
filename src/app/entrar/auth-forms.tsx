"use client";
import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { forgotPassword, signIn, signUp, type AuthState } from "./actions";

export function AuthForms({ mode, next }: { mode: "signin" | "signup" | "forgot"; next: string }) {
  const action = mode === "signup" ? signUp : mode === "forgot" ? forgotPassword : signIn;
  const [state, formAction] = useActionState<AuthState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {mode === "signup" && (
        <div><label className="label" htmlFor="name">Seu nome</label><input id="name" name="name" className="field" autoComplete="name" required /></div>
      )}
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="field" autoComplete="email" required /></div>
      {mode !== "forgot" && (
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Senha</label>
            {mode === "signin" && <Link href="/entrar?modo=esqueci" className="mb-1.5 text-sm text-brand">Esqueci a senha</Link>}
          </div>
          <input id="password" name="password" type="password" minLength={8} className="field" autoComplete={mode === "signup" ? "new-password" : "current-password"} required />
        </div>
      )}
      {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-bad">{state.error}</p>}
      {state.message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-good">{state.message}</p>}
      <SubmitButton>{mode === "signup" ? "Criar conta grátis" : mode === "forgot" ? "Enviar link" : "Entrar"}</SubmitButton>
      {mode === "forgot" && <Link href="/entrar" className="block text-center text-sm text-muted">Voltar para o login</Link>}
    </form>
  );
}
