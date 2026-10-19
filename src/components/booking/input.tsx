"use client";
import type { ResolvedTheme } from "./types";

export function Input({ label, value, onChange, theme, optional, ...rest }: { label: string; value: string; onChange: (v: string) => void; theme: ResolvedTheme; optional?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}{optional && <span className="opacity-60"> (opcional)</span>}</span>
      <input {...rest} required={!optional} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-transparent px-3.5 py-3 text-base outline-none" style={{ border: `1px solid ${theme.text}33`, color: theme.text }} />
    </label>
  );
}
