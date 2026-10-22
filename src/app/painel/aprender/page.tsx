import type { Metadata } from "next";
import { HelpTip } from "@/components/help-tip";
import { LearnView, SuggestionBox } from "./view";

export const metadata: Metadata = { title: "Aprender" };

export default function AprenderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aprender<HelpTip>Vídeos curtos e passo a passo de cada parte do Só Marcar. Os mesmos tutoriais abrem nas interrogações (?) de cada tela.</HelpTip></h1>
        <p className="text-sm text-muted">Tutoriais rápidos para tirar o máximo do app.</p>
      </div>
      <LearnView />
      <SuggestionBox />
    </div>
  );
}
