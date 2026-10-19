// Temas da página inicial: um por nicho, mais o neutro ("outro") que aparece antes da escolha.
// As fontes vêm de next/font (variáveis CSS definidas em fonts.ts).

export type NicheId = "barbearia" | "salao" | "tatuagem" | "piercing" | "personal" | "outro";

export type Niche = {
  id: NicheId;
  name: string;
  short: string;
  tileWord: string;
  examples: string;
  h1a: string;
  h1b: string;
  sub: string;
  cta: string;
  bizKind: string;
  bizName: string;
  pro: string;
  clientWord: string;
  clientPlural: string;
  notice: string;
  forWho: string;
  painTitle: string;
  pains: string[];
  gains: string[];
  services: [string, string, string][];
  colors: {
    ground: string;
    ink: string;
    muted: string;
    accent: string;
    accentInk: string;
    line: string;
    accentLine: string;
    accentSoft: string;
    glow: string;
    panel: string;
    panelStrong: string;
    band: string;
    headerBg: string;
    phoneBg: string;
    rowBg: string;
    bg: string;
    cover: string;
  };
  type: { display: string; weight: number; style: "normal" | "italic"; transform: "none" | "uppercase"; tracking: string };
};

export const NEUTRAL: Niche = {
  id: "outro",
  name: "Outro negócio",
  short: "Outro",
  tileWord: "Hora marcada",
  examples: "Manicure, estética, terapias e mais",
  h1a: "Sua agenda cheia,",
  h1b: "sem viver no WhatsApp.",
  sub: "O cliente marca pelo seu link, recebe lembrete e remarca sozinho. Todo dia o app mostra quem chamar para voltar.",
  cta: "Pronto para encher a agenda?",
  bizKind: "Agendamento online",
  bizName: "Espaço Lumi",
  pro: "Ana",
  clientWord: "cliente",
  clientPlural: "clientes",
  notice: "Carla marcou amanhã, 10:30",
  forWho: "Para quem trabalha com hora marcada",
  painTitle: "Menos tempo respondendo, mais tempo atendendo.",
  pains: ["Responder horário no WhatsApp o dia inteiro", "Cliente que falta e não avisa", "Cliente bom que some e você nem percebe"],
  gains: ["Cliente marca sozinho pelo link, a qualquer hora", "Lembrete antes do horário e remarcação em um toque", "Lista diária de quem chamar de volta"],
  services: [["Atendimento completo", "1 h", "R$ 80"], ["Sessão rápida", "30 min", "R$ 45"], ["Pacote mensal", "4 sessões", "R$ 280"]],
  colors: {
    ground: "#100f14",
    ink: "#f3f1f8",
    muted: "#aca8bb",
    accent: "#a48bff",
    accentInk: "#120c26",
    line: "rgba(243,241,248,.12)",
    accentLine: "rgba(164,139,255,.45)",
    accentSoft: "rgba(164,139,255,.16)",
    glow: "rgba(164,139,255,.35)",
    panel: "rgba(255,255,255,.04)",
    panelStrong: "#17151d",
    band: "rgba(255,255,255,.02)",
    headerBg: "rgba(16,15,20,.72)",
    phoneBg: "#15131b",
    rowBg: "rgba(255,255,255,.04)",
    bg: "radial-gradient(1000px 560px at 50% -12%, rgba(164,139,255,.26), transparent 62%), repeating-linear-gradient(90deg, rgba(255,255,255,.025) 0 1px, transparent 1px 80px), repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 1px, transparent 1px 80px), #100f14",
    cover: "linear-gradient(180deg, rgba(0,0,0,.05), rgba(10,6,24,.82)), radial-gradient(circle at 70% 20%, #8f78ff, #3b2a7a 55%, #120c26 100%)",
  },
  type: { display: "var(--font-manrope), sans-serif", weight: 800, style: "normal", transform: "none", tracking: "-0.04em" },
};

export const NICHES: Niche[] = [
  {
    id: "barbearia",
    name: "Barbearia",
    short: "Barbearia",
    tileWord: "Couro & Navalha",
    examples: "Barbearias e barber shops",
    h1a: "Cadeira cheia,",
    h1b: "navalha afiada.",
    sub: "Seu cliente marca o corte pelo link, recebe lembrete e volta no tempo certo. Você só cuida da navalha.",
    cta: "Bora encher essa cadeira?",
    bizKind: "Barbearia",
    bizName: "Barbearia do Zé",
    pro: "Zé",
    clientWord: "cliente",
    clientPlural: "clientes",
    notice: "Rafael marcou corte + barba",
    forWho: "Feito para barbearia",
    painTitle: "Menos celular na mão, mais navalha.",
    pains: ["Cliente chamando no WhatsApp no meio do corte", "Furo na agenda e cadeira vazia à tarde", "Cliente fiel some e você só percebe meses depois"],
    gains: ["Cliente marca sozinho pelo link, até de madrugada", "Lembrete antes do horário e remarcação em um toque", "Aviso de quem passou do tempo de voltar"],
    services: [["Corte masculino", "40 min", "R$ 45"], ["Barba na toalha quente", "30 min", "R$ 35"], ["Corte + barba", "1h10", "R$ 70"]],
    colors: {
      ground: "#15110d",
      ink: "#f3ead8",
      muted: "#bcae95",
      accent: "#d9a84e",
      accentInk: "#1a1208",
      line: "rgba(243,234,216,.13)",
      accentLine: "rgba(217,168,78,.45)",
      accentSoft: "rgba(217,168,78,.16)",
      glow: "rgba(217,168,78,.30)",
      panel: "rgba(255,248,235,.04)",
      panelStrong: "#1d1813",
      band: "rgba(0,0,0,.18)",
      headerBg: "rgba(21,17,13,.74)",
      phoneBg: "#1b1611",
      rowBg: "rgba(255,248,235,.05)",
      bg: "radial-gradient(1100px 600px at 85% -8%, rgba(217,168,78,.20), transparent 60%), repeating-linear-gradient(0deg, rgba(0,0,0,.30) 0 3px, transparent 3px 46px), repeating-linear-gradient(90deg, rgba(255,255,255,.022) 0 2px, transparent 2px 92px), #15110d",
      cover: "linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.78)), repeating-linear-gradient(0deg, rgba(0,0,0,.45) 0 4px, transparent 4px 30px), repeating-linear-gradient(90deg, rgba(0,0,0,.30) 0 4px, transparent 4px 60px), radial-gradient(circle at 30% 20%, #a4532e, #5a2a17 70%)",
    },
    type: { display: "var(--font-playfair), serif", weight: 900, style: "normal", transform: "none", tracking: "-0.01em" },
  },
  {
    id: "salao",
    name: "Salão e estética",
    short: "Salão",
    tileWord: "Champagne & Rosé",
    examples: "Salões, unhas e clínicas",
    h1a: "Sua cliente marca,",
    h1b: "você encanta.",
    sub: "Agenda elegante para salão, estética e unhas: serviço, profissional e horário escolhidos em segundos, com lembrete automático.",
    cta: "Pronta para sair do padrão?",
    bizKind: "Salão e estética",
    bizName: "Studio Bella",
    pro: "Júlia",
    clientWord: "cliente",
    clientPlural: "clientes",
    notice: "Mariana marcou escova",
    forWho: "Feito para salão e estética",
    painTitle: "Cada profissional com a sua agenda, sem confusão.",
    pains: ["Agenda no caderno e no WhatsApp ao mesmo tempo", "Duas clientes marcadas no mesmo horário", "Cliente esquece e não avisa"],
    gains: ["Cada profissional com seus horários e serviços", "Horário ocupado nunca aparece duas vezes", "Lembrete automático e remarcação pelo link"],
    services: [["Escova modelada", "50 min", "R$ 60"], ["Design de sobrancelha", "30 min", "R$ 40"], ["Manicure e pedicure", "1h20", "R$ 55"]],
    colors: {
      ground: "#f6efe8",
      ink: "#2a1d1f",
      muted: "#6b585b",
      accent: "#9a4558",
      accentInk: "#ffffff",
      line: "rgba(42,29,31,.12)",
      accentLine: "rgba(154,69,88,.38)",
      accentSoft: "rgba(154,69,88,.10)",
      glow: "rgba(154,69,88,.22)",
      panel: "rgba(255,255,255,.55)",
      panelStrong: "#ffffff",
      band: "rgba(255,255,255,.4)",
      headerBg: "rgba(246,239,232,.80)",
      phoneBg: "#fbf7f3",
      rowBg: "#ffffff",
      bg: "radial-gradient(900px 520px at 92% 0%, rgba(154,69,88,.15), transparent 60%), radial-gradient(800px 560px at 0% 40%, rgba(214,178,132,.22), transparent 60%), #f6efe8",
      cover: "linear-gradient(180deg, rgba(0,0,0,0), rgba(40,18,24,.72)), radial-gradient(circle at 75% 25%, #f2d3c4, #c98f8f 45%, #7a3e4c 100%)",
    },
    type: { display: "var(--font-cormorant), serif", weight: 600, style: "italic", transform: "none", tracking: "-0.01em" },
  },
  {
    id: "tatuagem",
    name: "Tatuagem",
    short: "Tatuagem",
    tileWord: "Tinta & Neon",
    examples: "Estúdios de tattoo e flash",
    h1a: "Sua arte merece",
    h1b: "agenda à altura.",
    sub: "Sessões longas, avaliação marcada e cliente que não esquece o horário. Sem caderninho, sem mensagem perdida.",
    cta: "Pronto pra sair do padrão?",
    bizKind: "Estúdio de tatuagem",
    bizName: "Ink Lab",
    pro: "Léo",
    clientWord: "cliente",
    clientPlural: "clientes",
    notice: "Bruna marcou avaliação",
    forWho: "Feito para estúdio de tatuagem",
    painTitle: "Menos DM perdida, mais sessão fechada.",
    pains: ["Orçamento perdido no meio das mensagens", "Sessão longa marcada em cima de outra", "Cliente some no dia da sessão"],
    gains: ["Avaliação e sessão marcadas pelo link", "A duração real de cada sessão fica bloqueada", "Lembrete antes da sessão e remarcação fácil"],
    services: [["Sessão fechada", "4 h", "R$ 600"], ["Flash tattoo", "1h30", "R$ 250"], ["Avaliação do projeto", "30 min", "Grátis"]],
    colors: {
      ground: "#0a0a0c",
      ink: "#f2f2f4",
      muted: "#a2a2ab",
      accent: "#ff4d78",
      accentInk: "#16020a",
      line: "rgba(242,242,244,.11)",
      accentLine: "rgba(255,77,120,.45)",
      accentSoft: "rgba(255,77,120,.14)",
      glow: "rgba(255,77,120,.32)",
      panel: "rgba(255,255,255,.035)",
      panelStrong: "#121216",
      band: "rgba(255,255,255,.015)",
      headerBg: "rgba(10,10,12,.76)",
      phoneBg: "#111114",
      rowBg: "rgba(255,255,255,.04)",
      bg: "radial-gradient(820px 520px at 82% 6%, rgba(255,77,120,.20), transparent 60%), radial-gradient(600px 420px at 5% 70%, rgba(90,60,255,.12), transparent 60%), repeating-linear-gradient(135deg, rgba(255,255,255,.02) 0 1px, transparent 1px 14px), #0a0a0c",
      cover: "linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.82)), repeating-linear-gradient(135deg, rgba(255,77,120,.35) 0 2px, transparent 2px 18px), radial-gradient(circle at 70% 30%, #3a1a3f, #0b0b10 75%)",
    },
    type: { display: "var(--font-archivo-black), sans-serif", weight: 400, style: "normal", transform: "uppercase", tracking: "-0.02em" },
  },
  {
    id: "piercing",
    name: "Body piercing",
    short: "Body piercing",
    tileWord: "Aço & Brilho",
    examples: "Piercers, joias e perfuração",
    h1a: "Cada furo no lugar,",
    h1b: "cada horário também.",
    sub: "Perfuração, troca de joia e retorno marcados pelo seu link. O cliente escolhe o horário, recebe lembrete e volta na hora certa da troca.",
    cta: "Bora brilhar a agenda?",
    bizKind: "Estúdio de piercing",
    bizName: "Pierce Co.",
    pro: "Nina",
    clientWord: "cliente",
    clientPlural: "clientes",
    notice: "Júlia marcou perfuração",
    forWho: "Feito para body piercer",
    painTitle: "Menos direct perdido, mais perfuração marcada.",
    pains: ["Pedido de horário perdido no direct", "Cliente esquece o retorno da troca de joia", "Encaixe que vira atraso no estúdio inteiro"],
    gains: ["Perfuração e troca marcadas pelo link", "Lembrete do retorno na época certa", "Tempo de cada procedimento bloqueado na agenda"],
    services: [["Perfuração + joia", "30 min", "R$ 120"], ["Troca de joia", "15 min", "R$ 40"], ["Retorno e avaliação", "15 min", "Grátis"]],
    colors: {
      ground: "#0b0d10",
      ink: "#eef3f6",
      muted: "#9aa6ad",
      accent: "#5eead4",
      accentInk: "#022620",
      line: "rgba(238,243,246,.11)",
      accentLine: "rgba(94,234,212,.45)",
      accentSoft: "rgba(94,234,212,.13)",
      glow: "rgba(94,234,212,.28)",
      panel: "rgba(255,255,255,.035)",
      panelStrong: "#11151a",
      band: "rgba(255,255,255,.015)",
      headerBg: "rgba(11,13,16,.78)",
      phoneBg: "#101317",
      rowBg: "rgba(255,255,255,.04)",
      bg: "radial-gradient(820px 520px at 84% 4%, rgba(94,234,212,.18), transparent 60%), radial-gradient(640px 440px at 4% 72%, rgba(186,196,210,.10), transparent 60%), radial-gradient(circle at 1px 1px, rgba(255,255,255,.05) 1px, transparent 1.5px) 0 0/22px 22px, #0b0d10",
      cover: "linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.8)), radial-gradient(circle at 70% 28%, rgba(94,234,212,.55), transparent 40%), radial-gradient(circle at 30% 70%, #3b4450, #0b0d10 75%)",
    },
    type: { display: "var(--font-archivo-black), sans-serif", weight: 400, style: "normal", transform: "uppercase", tracking: "-0.02em" },
  },
  {
    id: "personal",
    name: "Personal e estúdio",
    short: "Personal",
    tileWord: "Energia & Foco",
    examples: "Personal, pilates e funcional",
    h1a: "Aluno no horário,",
    h1b: "treino no ritmo.",
    sub: "Agenda aberta 24h para personal e estúdio: o aluno escolhe o horário, remarca sozinho e você vê quem sumiu antes de perder.",
    cta: "Bora pra cima?",
    bizKind: "Personal e estúdio",
    bizName: "Studio Move",
    pro: "Caio",
    clientWord: "aluno",
    clientPlural: "alunos",
    notice: "Pedro marcou treino às 7h",
    forWho: "Feito para personal e estúdio",
    painTitle: "Menos remarcação por mensagem, mais treino dado.",
    pains: ["Aluno remarcando por mensagem toda semana", "Horário vago que ninguém preenche", "Aluno some e você só percebe no fim do mês"],
    gains: ["Aluno escolhe e remarca sozinho pelo link", "Oportunidades de Hoje mostra os horários para preencher", "Aviso de quem parou de treinar"],
    services: [["Treino personalizado", "1 h", "R$ 90"], ["Avaliação física", "45 min", "R$ 70"], ["Pilates em dupla", "50 min", "R$ 80"]],
    colors: {
      ground: "#0d1411",
      ink: "#eef5ee",
      muted: "#a3b5a9",
      accent: "#c8f03c",
      accentInk: "#0d1411",
      line: "rgba(238,245,238,.11)",
      accentLine: "rgba(200,240,60,.42)",
      accentSoft: "rgba(200,240,60,.13)",
      glow: "rgba(200,240,60,.25)",
      panel: "rgba(255,255,255,.035)",
      panelStrong: "#121c17",
      band: "rgba(0,0,0,.15)",
      headerBg: "rgba(13,20,17,.76)",
      phoneBg: "#111a16",
      rowBg: "rgba(255,255,255,.04)",
      bg: "radial-gradient(900px 520px at 86% 0%, rgba(200,240,60,.15), transparent 60%), repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0 1px, transparent 1px 64px), repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 1px, transparent 1px 64px), #0d1411",
      cover: "linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.8)), repeating-linear-gradient(115deg, rgba(200,240,60,.28) 0 6px, transparent 6px 26px), radial-gradient(circle at 30% 30%, #2f4a3c, #0d1411 75%)",
    },
    type: { display: "var(--font-barlow), sans-serif", weight: 800, style: "italic", transform: "uppercase", tracking: "0" },
  },
  NEUTRAL,
];

export function findNiche(id: string | undefined | null): Niche | null {
  return NICHES.find((n) => n.id === id) ?? null;
}
