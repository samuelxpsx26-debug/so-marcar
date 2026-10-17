"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";

export type AuthState = { error?: string; message?: string };

const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/painel";
};

const creds = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
});

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message.includes("confirm") ? "Confirme seu e-mail pelo link que enviamos." : "E-mail ou senha incorretos." };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = creds.extend({ name: z.string().trim().min(2, "Informe seu nome") }).safeParse({
    email: form.get("email"), password: form.get("password"), name: form.get("name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.name }, emailRedirectTo: `${SITE_URL}/auth/callback?next=/comecar` },
  });
  if (error) return { error: error.message.includes("registered") ? "Esse e-mail já tem conta. Entre ou recupere a senha." : "Não foi possível criar a conta agora." };
  if (!data.session) return { message: "Quase lá! Enviamos um link de confirmação para o seu e-mail." };
  redirect("/comecar");
}

export async function forgotPassword(_: AuthState, form: FormData): Promise<AuthState> {
  const email = z.string().trim().email().safeParse(form.get("email"));
  if (!email.success) return { error: "E-mail inválido" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${SITE_URL}/auth/callback?next=/redefinir-senha` });
  // Mesma resposta exista ou não a conta, para não revelar quem é cliente
  return { message: "Se esse e-mail tiver conta, você vai receber um link para criar uma nova senha." };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const pw = z.string().min(8).safeParse(form.get("password"));
  if (!pw.success) return { error: "A senha precisa ter pelo menos 8 caracteres" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) return { error: "Link expirado. Peça um novo." };
  redirect("/painel");
}
