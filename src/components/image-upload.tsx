"use client";
import { useRef, useState, useTransition } from "react";
import { MEDIA_MAX_SIDE, type MediaKind } from "@/lib/media";
import { HelpTip } from "./help-tip";

type Result = { ok?: boolean; error?: string; url?: string | null };

/** Reduz a foto no próprio celular antes de enviar: carrega mais rápido e cabe no limite */
async function shrink(file: File, kind: MediaKind): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const max = MEDIA_MAX_SIDE[kind];
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  // Logo pode ter fundo transparente: WebP (ou PNG se o navegador não gerar WebP). Fotos: JPEG.
  const type = kind === "logo" ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.85));
  if (blob && blob.type === type) return blob;
  return new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("png"))), "image/png"));
}

type Props = {
  kind: MediaKind;
  label: string;
  hint?: string;
  current: string | null;
  upload: (form: FormData) => Promise<Result>;
  remove: () => Promise<Result>;
  onChange?: (url: string | null) => void;
  shape?: "wide" | "square" | "round";
  help?: string;
};

export function ImageUpload({ kind, label, hint, current, upload, remove, onChange, shape = "square", help }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function apply(next: string | null) {
    setUrl(next);
    onChange?.(next);
  }

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    start(async () => {
      let blob: Blob;
      try {
        blob = await shrink(file, kind);
      } catch {
        setError("Não deu para ler essa foto. Tente outra (JPG ou PNG).");
        if (input.current) input.current.value = "";
        return;
      }
      try {
        const form = new FormData();
        form.set("file", new File([blob], `foto.${blob.type.split("/")[1]}`, { type: blob.type }));
        const r = await upload(form);
        if (r.error) setError(r.error);
        else apply(r.url ?? null);
      } catch {
        setError("Não foi possível enviar a foto agora. Confira a internet e tente de novo.");
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  }

  const box = shape === "wide" ? "h-24 w-40" : shape === "round" ? "h-16 w-16 rounded-full" : "h-16 w-16";

  return (
    <div>
      <p className="label">{label}{help && <HelpTip>{help}</HelpTip>}</p>
      <div className="flex items-center gap-3">
        <div className={`${box} shrink-0 overflow-hidden rounded-xl border border-line bg-zinc-100 ${shape === "round" ? "rounded-full" : ""}`}>
          {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-xs text-muted">Sem foto</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" id={`up-${kind}-${label}`} onChange={(e) => pick(e.target.files?.[0])} disabled={pending} />
          <label htmlFor={`up-${kind}-${label}`} className={`btn btn-ghost cursor-pointer ${pending ? "pointer-events-none opacity-50" : ""}`}>
            {pending ? "Enviando…" : url ? "Trocar foto" : "Enviar foto"}
          </label>
          {url && !pending && (
            <button type="button" className="btn px-3 text-sm text-muted" onClick={() => start(async () => { const r = await remove(); if (r.error) setError(r.error); else apply(null); })}>Remover</button>
          )}
        </div>
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-sm text-bad">{error}</p>}
    </div>
  );
}
