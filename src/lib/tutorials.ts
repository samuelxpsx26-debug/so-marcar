// Tutoriais da área Aprender e das interrogações (?). Vídeos curtos ficam em public/tutoriais/.
// Para trocar um vídeo, substitua o .mp4 com o mesmo nome (e o .jpg da capa).

export type Tutorial = {
  id: string; title: string; topic: string; summary: string;
  /** duração do vídeo em segundos; sem vídeo, o tutorial mostra só o passo a passo */
  seconds: number | null;
  steps: string[];
};

export const videoSrc = (t: Tutorial) => `/tutoriais/${t.id}.mp4`;
export const posterSrc = (t: Tutorial) => `/tutoriais/${t.id}.jpg`;

export const TUTORIALS: Tutorial[] = [
  {
    id: "primeiros-passos", topic: "Começar", title: "Primeiros passos", seconds: 28,
    summary: "Deixe sua página pronta para receber agendamentos.",
    steps: [
      "Em Serviços, toque em \"+ Adicionar serviço\" e coloque nome, duração e preço.",
      "Em Equipe, confira os dias, horários e a pausa do almoço de cada profissional.",
      "Em Aparência, escolha o estilo e a foto da sua página.",
      "Abra seu link e faça um agendamento de teste para ver como o cliente vê.",
    ],
  },
  {
    id: "compartilhar-link", topic: "Começar", title: "Compartilhar seu link", seconds: 23,
    summary: "Coloque o link na bio e deixe o cliente marcar sozinho.",
    steps: [
      "No celular, toque em \"Compartilhar link\" no topo do painel. No computador, toque em \"copiar link\" embaixo do nome do negócio.",
      "Cole o link na bio do Instagram, no WhatsApp Business e no Google.",
      "O cliente escolhe serviço, profissional e horário, sem baixar app nem criar conta.",
      "O agendamento aparece na sua Agenda na mesma hora.",
    ],
  },
  {
    id: "sinal-pix", topic: "Dinheiro", title: "Sinal por Pix contra faltas", seconds: 28,
    summary: "Só garante o horário quem paga o sinal.",
    steps: [
      "Em Ajustes, vá até \"Sinal por Pix\".",
      "Escolha porcentagem ou valor fixo e o prazo para pagar.",
      "Coloque sua chave Pix, o nome de quem recebe e a cidade, e toque em \"Salvar sinal\".",
      "Quem reserva vê o QR Code. O horário fica \"aguardando sinal\" na agenda até você tocar em \"Sinal recebido\".",
    ],
  },
  {
    id: "gastos", topic: "Financeiro", title: "Lançar gastos e ver o lucro real", seconds: 28,
    summary: "Saiba quanto sobrou de verdade no mês.",
    steps: [
      "Abra Financeiro (no celular, fica em \"Mais\").",
      "Em Gastos fixos, toque em \"+ Gasto fixo\" para aluguel, energia e internet. Eles entram sozinhos todo mês.",
      "Para gasolina, café ou anúncio, toque em \"+ Lançar gasto\" com valor, data e categoria.",
      "O Lucro real já desconta comissões e gastos, e \"Contas do mês\" mostra quanto falta faturar.",
    ],
  },
  {
    id: "comissoes", topic: "Financeiro", title: "Comissão da equipe", seconds: 27,
    summary: "A comissão de cada profissional calculada sozinha.",
    steps: [
      "Em Financeiro, desça até Comissões e toque em \"Definir comissão\" no profissional.",
      "Escolha \"% do valor\" ou \"R$ por atendimento\" e salve. Se quiser, crie uma regra diferente para algum serviço.",
      "A comissão conta os atendimentos marcados como \"Atendido\" na agenda.",
      "No fim do mês, toque em \"Marcar como paga\" e em \"Enviar resumo\" para mandar pelo WhatsApp.",
    ],
  },
  {
    id: "atendido", topic: "Agenda", title: "Marcar atendido ou falta", seconds: null,
    summary: "É isso que alimenta relatórios, fidelidade e comissões.",
    steps: [
      "Na Agenda, toque no atendimento depois que ele acontecer.",
      "Toque em \"✓ Atendido\" quando o cliente veio, ou em \"Faltou\" quando não apareceu.",
      "Só atendimentos marcados como Atendido entram no faturamento, nos selos de fidelidade e nas comissões.",
    ],
  },
  {
    id: "pacotes", topic: "Dinheiro", title: "Vender pacotes", seconds: null,
    summary: "Venda várias sessões de uma vez e garanta o retorno.",
    steps: [
      "Em Serviços, desça até Pacotes e toque em \"+ Criar pacote\".",
      "Escolha o serviço, o número de sessões, o preço e a validade.",
      "Quando o cliente comprar, abra a ficha dele em Clientes e toque em \"Vender pacote\".",
      "A cada visita, toque no atendimento na agenda e use \"Atendido usando o pacote\".",
    ],
  },
  {
    id: "clube", topic: "Dinheiro", title: "Clube mensal", seconds: null,
    summary: "Mensalidade com atendimentos por mês e receita garantida.",
    steps: [
      "Em Serviços, desça até Clube mensal e toque em \"+ Criar plano do clube\".",
      "Defina a mensalidade, quantos atendimentos por mês e os serviços incluídos.",
      "Na ficha do cliente em Clientes, toque em \"Assinar clube\" e, a cada pagamento, em \"Mensalidade recebida\".",
      "Na agenda, use \"Atendido pelo clube\" e o atendimento sai sem valor.",
    ],
  },
  {
    id: "quem-sumiu", topic: "Clientes", title: "Chamar quem sumiu", seconds: null,
    summary: "Traga de volta clientes que não aparecem há um tempo.",
    steps: [
      "Abra Campanhas (no celular, fica em \"Mais\").",
      "Em \"Sem vir há\", escolha há quantos dias o cliente não volta.",
      "Ajuste a mensagem se quiser e toque em \"Chamar\" para abrir o WhatsApp com ela pronta.",
      "Quem você já chamou fica marcado para não repetir.",
    ],
  },
];

export const findTutorial = (id: string) => TUTORIALS.find((t) => t.id === id) ?? null;
export const TOPICS = [...new Set(TUTORIALS.map((t) => t.topic))];

/** Tutoriais já assistidos ficam salvos no aparelho */
export const WATCHED_KEY = "somarcar:tutoriais-vistos";
