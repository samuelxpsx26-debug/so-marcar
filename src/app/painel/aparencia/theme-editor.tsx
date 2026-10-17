"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { SEGMENTS, type Segment } from "@/lib/segments";
import { resolveTheme, type Theme } from "@/lib/theme";
import { saveTheme, type R } from "./actions";

const PALETTES = [
  { name: "Violeta", primary: "#7c3aed", background: "#ffffff" },
  { name: "Noite dourada", primary: "#d4a24c", background: "#14100c" },
  { name: "Rosé", primary: "#e86fa6", background: "#1a1020" },
  { name: "Menta", primary: "#2f8f7a", background: "#f6fbfa" },
  { name: "Energia", primary: "#22c55e", background: "#0b1220" },
  { name: "Clássico", primary: "#111111", background: "#f5f5f4" },
  { name: "Coral", primary: "#f97316", background: "#fff7ed" },
  { name: "Oceano", primary: "#0284c7", background: "#f0f9ff" },
];

export function ThemeEditor({ name, segment, theme, description }: { name: string; segment: Segment; theme: Theme; description: string | null }) {
  const [state, action] = useActionState<R, FormData>(saveTheme, {});
  const [primary, setPrimary] = useState(theme.primary ?? SEGMENTS[segment].suggestion.primary);
  const [background, setBackground] = useState(theme.background ?? SEGMENTS[segment].suggestion.background);
  const [image, setImage] = useState(theme.image ?? "");
  const t = resolveTheme({ primary, background, image }, segment);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <form action={action} className="card space-y-5">
        <div>
          <p className="label">Combinações prontas</p>
          <div className="grid grid-cols-4 gap-2">
            {PALETTES.map((p) => (
              <button key={p.name} type="button" onClick={() => { setPrimary(p.primary); setBackground(p.background); }} className="rounded-xl border border-line p-2 text-left text-[11px]">
                <span className="flex h-8 overflow-hidden rounded-lg"><span className="flex-1" style={{ background: p.background }} /><span className="w-1/3" style={{ background: p.primary }} /></span>
                <span className="mt-1 block truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Cor dos botões" name="primary" value={primary} onChange={setPrimary} />
          <ColorField label="Cor de fundo" name="background" value={background} onChange={setBackground} />
        </div>
        {t.lowContrastPrimary && <p className="rounded-xl bg-amber-50 p-3 text-sm text-warn">A cor dos botões está muito parecida com o fundo. Seus clientes podem ter dificuldade para ver.</p>}
        <div>
          <label className="label" htmlFor="image">Imagem de fundo (link https, opcional)</label>
          <input id="image" name="image" className="field" placeholder="https://…" value={image} onChange={(e) => setImage(e.target.value)} />
          <p className="mt-1 text-xs text-muted">Sem imagem, usamos um fundo próprio para {SEGMENTS[segment].label.toLowerCase()}. Envio de fotos direto pelo app vem na próxima versão.</p>
        </div>
        <div>
          <label className="label" htmlFor="description">Frase de apresentação</label>
          <textarea id="description" name="description" rows={2} maxLength={1000} className="field" defaultValue={description ?? ""} placeholder="Ex.: Cortes clássicos e modernos no centro de Campinas." />
        </div>
        {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        {state.ok && <p role="status" className="text-sm text-good">Salvo! Sua página já está com a nova cara.</p>}
        <SubmitButton>Salvar aparência</SubmitButton>
      </form>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <p className="label">Prévia</p>
        <div className="overflow-hidden rounded-[2rem] border-8 border-zinc-900 shadow-xl" style={{ backgroundColor: t.background, backgroundImage: t.backgroundImage, backgroundSize: "cover", color: t.text }}>
          <div className="space-y-3 p-5" style={{ minHeight: 420 }}>
            <p className="text-xl font-bold">{name}</p>
            <p className="text-sm opacity-75">Escolha o serviço</p>
            {["Serviço principal", "Outro serviço"].map((s, i) => (
              <div key={s} className="rounded-2xl p-3 text-sm" style={{ background: t.text === "#ffffff" ? "#ffffff14" : "#00000008", outline: i === 0 ? `2px solid ${t.primary}` : undefined }}>
                <p className="font-semibold">{s}</p><p className="opacity-70">30 min · R$ 40,00</p>
              </div>
            ))}
            <div className="flex gap-2">{["09:00", "09:30", "10:00"].map((h, i) => <span key={h} className="rounded-xl px-3 py-2 text-sm font-semibold" style={i === 1 ? { background: t.primary, color: t.onPrimary } : { border: `1px solid ${t.text}33` }}>{h}</span>)}</div>
            <span className="block rounded-xl py-3 text-center text-sm font-bold" style={{ background: t.primary, color: t.onPrimary }}>Confirmar agendamento</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <div className="flex items-center gap-2 rounded-xl border border-line p-1.5">
        <input id={name} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent" />
        <input name={name} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent font-mono text-sm outline-none" maxLength={7} />
      </div>
    </div>
  );
}
