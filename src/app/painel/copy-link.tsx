"use client";
import { useState } from "react";
import { publicOrigin } from "@/lib/env";

export function CopyLink({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = `${publicOrigin()}/${slug}`;
    try {
      if (navigator.share && compact) await navigator.share({ title: "Agende comigo", url });
      else await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* usuário cancelou */ }
  }
  return compact ? (
    <button onClick={copy} className="btn btn-primary px-3 py-1.5 text-xs">{copied ? "Copiado!" : "Compartilhar link"}</button>
  ) : (
    <button onClick={copy} className="mt-1 block w-full truncate text-left text-xs text-brand">{copied ? "Link copiado!" : `/${slug} · copiar link`}</button>
  );
}
