import type { Metadata } from "next";
import { getContext } from "@/lib/business";
import { brandFonts } from "@/components/brand-fonts";
import { ThemeEditor } from "./theme-editor";

export const metadata: Metadata = { title: "Aparência" };

export default async function AparenciaPage() {
  const { business } = await getContext();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aparência da sua página</h1>
        <p className="text-sm text-muted">Escolha o estilo, as cores e a foto de capa que combinam com o seu negócio. A prévia mostra como o cliente vê.</p>
      </div>
      <div className={brandFonts}><ThemeEditor name={business.name} segment={business.segment} theme={business.theme} description={business.description} /></div>
    </div>
  );
}
