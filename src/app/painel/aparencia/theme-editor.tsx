"use client";
import { useActionState, useMemo, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { SEGMENTS, type Segment } from "@/lib/segments";
import { resolveTheme, styleForSegment, THEME_STYLE_IDS, THEME_STYLES, type Theme, type ThemeStyle } from "@/lib/theme";
import { ImageUpload } from "@/components/image-upload";
import { BACKDROPS, backgroundCatalog, isCatalogBackground, type CatalogItem } from "@/lib/backgrounds";
import { removeBackground, removeCover, removeLogo, saveTheme, uploadBackground, uploadCover, uploadLogo, type R } from "./actions";

export function ThemeEditor({ name, segment, theme, description }: { name: string; segment: Segment; theme: Theme; description: string | null }) {
  const [state, action] = useActionState<R, FormData>(saveTheme, {});
  const [style, setStyle] = useState<ThemeStyle>(theme.style ?? styleForSegment(segment));
  const [primary, setPrimary] = useState(theme.primary ?? SEGMENTS[segment].suggestion.primary);
  const [background, setBackground] = useState(theme.background ?? SEGMENTS[segment].suggestion.background);
  const [image, setImage] = useState<string | null>(theme.image ?? null);
  const [logo, setLogo] = useState<string | null>(theme.logo ?? null);
  const savedUpload = theme.bg && !isCatalogBackground(theme.bg) ? theme.bg : null;
  const [uploadedBg, setUploadedBg] = useState<string | null>(savedUpload);
  const [bgChoice, setBgChoice] = useState<string>(theme.bg === null ? "none" : theme.bg === undefined ? "auto" : savedUpload ? "upload" : theme.bg);
  const [otherPacks, setOtherPacks] = useState(false);
  const bg = bgChoice === "none" ? null : bgChoice === "auto" ? undefined : bgChoice === "upload" ? uploadedBg : bgChoice;
  const t = resolveTheme({ style, primary, background, image, logo, bg }, segment);
  const catalog = useMemo(() => backgroundCatalog(segment, style), [segment, style]);
  // "auto" = 1ª foto do pacote do estilo; escolher essa foto volta para "auto" (acompanha troca de estilo)
  const autoId = BACKDROPS[style][0].id;
  const isPicked = (i: CatalogItem) => bgChoice === i.id || (bgChoice === "auto" && i.id === autoId);
  const pick = (i: CatalogItem) => setBgChoice(i.id === autoId ? "auto" : i.id);
  const d = t.display;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
      <section className="card space-y-5">
        <ImageUpload kind="capa" shape="wide" label="Foto de capa" current={image} upload={uploadCover} remove={removeCover} onChange={setImage}
          hint="A fachada, o espaço por dentro ou um trabalho seu. Sem foto, a capa usa a arte do estilo." />
        <ImageUpload kind="logo" label="Logo" current={logo} upload={uploadLogo} remove={removeLogo} onChange={setLogo}
          hint="Aparece no topo da página. Sem logo, mostramos a inicial do nome." />
        <p className="text-xs text-muted">As fotos são salvas na hora, sem precisar clicar em salvar.</p>
      </section>
      <form action={action} className="card space-y-5">
        <div>
          <p className="label">Estilo</p>
          <input type="hidden" name="style" value={style} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEME_STYLE_IDS.map((id) => {
              const info = THEME_STYLES[id];
              const preview = resolveTheme({ style: id, ...info.defaults }, segment);
              return (
                <button key={id} type="button" aria-pressed={style === id}
                  onClick={() => { setStyle(id); setPrimary(info.defaults.primary); setBackground(info.defaults.background); }}
                  className={`overflow-hidden rounded-xl border text-left transition ${style === id ? "border-brand ring-4 ring-brand/15" : "border-line"}`}>
                  <span className="flex h-16 items-end p-2.5 text-white" style={{ backgroundImage: preview.cover }}>
                    <span className="text-base leading-none" style={{ fontFamily: info.display.family, fontWeight: info.display.weight, fontStyle: info.display.style, textTransform: info.display.transform }}>{info.label}</span>
                  </span>
                  <span className="block px-2.5 py-2 text-xs text-muted">{info.hint}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">Trocar o estilo aplica as cores dele. Depois você ajusta as cores como quiser.</p>
        </div>
        <div>
          <p className="label">Fundo da página</p>
          <p className="-mt-1 mb-2 text-xs text-muted">Primeiro as opções do seu nicho: estampas, fotos limpas e fotos de ambiente.</p>
          <input type="hidden" name="bg" value={bgChoice} />
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            <button type="button" aria-pressed={bgChoice === "none"} onClick={() => setBgChoice("none")}
              className={`grid aspect-[3/4] place-items-center rounded-xl border text-xs text-muted ${bgChoice === "none" ? "border-brand ring-4 ring-brand/15" : "border-line"}`}
              style={{ backgroundColor: background, backgroundImage: resolveTheme({ style, primary, background, bg: null }, segment).backgroundImage }}>
              <span className="rounded-full bg-white/85 px-2 py-0.5 text-zinc-700">Sem foto</span>
            </button>
            {uploadedBg && (
              <button type="button" aria-pressed={bgChoice === "upload"} onClick={() => setBgChoice("upload")}
                className={`relative aspect-[3/4] overflow-hidden rounded-xl border ${bgChoice === "upload" ? "border-brand ring-4 ring-brand/15" : "border-line"}`}>
                <img src={uploadedBg} alt="Sua foto" className="h-full w-full object-cover" />
                <span className="absolute inset-x-1 bottom-1 rounded-full bg-black/60 px-2 py-0.5 text-center text-[11px] text-white">Sua foto</span>
              </button>
            )}
            {catalog.mine.map((i) => <BackdropTile key={i.id} item={i} picked={isPicked(i)} onPick={() => pick(i)} />)}
          </div>
          {otherPacks && catalog.more.map((g) => (
            <div key={g.title} className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-muted">{g.title}</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {g.items.map((i) => <BackdropTile key={i.id} item={i} picked={isPicked(i)} onPick={() => pick(i)} />)}
              </div>
            </div>
          ))}
          <button type="button" className="mt-2 text-sm font-medium text-brand" onClick={() => setOtherPacks(!otherPacks)}>
            {otherPacks ? "Mostrar só as do seu nicho" : "Ver fundos de outros nichos"}
          </button>
          <div className="mt-4 rounded-xl border border-dashed border-line p-3">
            <ImageUpload kind="fundo" label="Foto do seu negócio no fundo" current={uploadedBg} upload={uploadBackground} remove={removeBackground}
              onChange={(url) => { setUploadedBg(url); setBgChoice(url ? "upload" : "auto"); }}
              hint="Uma foto do seu espaço fica ainda mais a sua cara. Ela é salva na hora e escurecida para o texto aparecer bem." />
          </div>
          <p className="mt-2 text-xs text-muted">Estampas feitas pelo Só Marcar. Fotos: Unsplash, livres para uso comercial. A página ajusta o texto e os cartões para continuar legível.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Cor dos botões" name="primary" value={primary} onChange={setPrimary} />
          <ColorField label="Cor de fundo" name="background" value={background} onChange={setBackground} />
        </div>
        {t.photo && <p className="-mt-3 text-xs text-muted">Com foto de fundo, a cor de fundo só aparece se você escolher &quot;Sem foto&quot;.</p>}
        {t.lowContrastPrimary && <p className="rounded-xl bg-amber-50 p-3 text-sm text-warn">A cor dos botões está muito parecida com o fundo. Seus clientes podem ter dificuldade para ver.</p>}
        <div>
          <label className="label" htmlFor="description">Frase de apresentação</label>
          <textarea id="description" name="description" rows={2} maxLength={1000} className="field" defaultValue={description ?? ""} placeholder="Ex.: Cortes clássicos e modernos no centro de Campinas." />
        </div>
        {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        {state.ok && <p role="status" className="text-sm text-good">Salvo! Sua página já está com a nova cara.</p>}
        <SubmitButton>Salvar aparência</SubmitButton>
      </form>
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <p className="label">Prévia</p>
        <div className="overflow-hidden rounded-[2rem] border-8 border-zinc-900 bg-cover bg-center shadow-xl" style={{ backgroundColor: t.ground, backgroundImage: t.backgroundImage, ...(t.backdrop ?? {}), color: t.text, textShadow: t.halo, fontFamily: "var(--font-manrope), system-ui, sans-serif" }}>
          <div className="space-y-3 p-4" style={{ minHeight: 420 }}>
            <div className="flex min-h-32 flex-col justify-end gap-2 rounded-2xl p-4 text-white" style={{ textShadow: "none", backgroundColor: "#0b0b0e", backgroundImage: t.cover, backgroundSize: "cover", backgroundPosition: "center" }}>
              {t.logo ? <img src={t.logo} alt="" className="h-10 w-10 rounded-xl bg-white object-contain" /> : <span className="grid h-10 w-10 place-items-center rounded-xl font-extrabold" style={{ background: t.primary, color: t.onPrimary }}>{name.slice(0, 1).toUpperCase()}</span>}
              <p className="text-2xl leading-none" style={{ fontFamily: d.family, fontWeight: d.weight, fontStyle: d.style, textTransform: d.transform, letterSpacing: d.tracking }}>{name}</p>
            </div>
            <p className="text-sm opacity-75">Escolha o serviço</p>
            {["Serviço principal", "Outro serviço"].map((s, i) => (
              <div key={s} className="rounded-2xl p-3 text-sm" style={{ background: t.surface, outline: i === 0 ? `2px solid ${t.primary}` : undefined }}>
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

function BackdropTile({ item, picked, onPick }: { item: CatalogItem; picked: boolean; onPick: () => void }) {
  return (
    <button type="button" aria-pressed={picked} onClick={onPick} title={item.credit ? `${item.label} · ${item.credit}` : item.label}
      className={`aspect-[3/4] overflow-hidden rounded-xl border bg-zinc-200 ${picked ? "border-brand ring-4 ring-brand/15" : "border-line"}`}
      style={item.pattern ? { backgroundColor: item.pattern.ground, backgroundImage: `url("${item.thumb}")`, backgroundSize: "200px" } : undefined}>
      {!item.pattern && <img src={item.thumb} alt={item.label} loading="lazy" className="h-full w-full object-cover" />}
      {item.pattern && <span className="sr-only">{item.label}</span>}
    </button>
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
