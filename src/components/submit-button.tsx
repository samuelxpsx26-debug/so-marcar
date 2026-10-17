"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText = "Aguarde…", className = "btn btn-primary w-full py-3.5" }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
