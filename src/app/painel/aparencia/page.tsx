import type { Metadata } from "next";
import { getContext } from "@/lib/business";
import { brandFonts } from "@/components/brand-fonts";
import { ThemeEditor } from "./theme-editor";
import { HelpTip } from "@/components/help-tip";

export const metadata: Metadata = { title: "Aparência" };

export default async function AparenciaPage() {
  const { business } = await getContext();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aparência da sua página<HelpTip>Como a sua página de agendamento aparece para o cliente: estilo, cores, fundo, capa e logo. A prévia ao lado mostra o resultado antes de salvar.</HelpTip></h1>
        <p className="text-sm text-muted">Escolha o estilo, as cores, a foto de fundo e a capa que combinam com o seu negócio. A prévia mostra como o cliente vê.</p>
      </div>
      <div className={brandFonts}><ThemeEditor name={business.name} segment={business.segment} theme={business.theme} description={business.description} /></div>
    </div>
  );
}
