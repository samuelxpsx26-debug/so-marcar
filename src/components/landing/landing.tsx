"use client";

import "./landing.css";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { NEUTRAL, NICHES, type Niche, type NicheId } from "./themes";

const SIGNUP = "/entrar?modo=cadastro";

const SLOTS: [string, "free" | "busy" | "on"][] = [
  ["08:00", "free"], ["09:00", "busy"], ["10:30", "on"], ["11:00", "free"],
  ["14:00", "free"], ["15:30", "busy"], ["17:00", "free"], ["18:30", "free"],
];

const FEATURES: [string, string][] = [
  ["Agenda aberta 24 horas", "Serviço, profissional e horário escolhidos pelo link, sem o cliente criar conta."],
  ["Remarcação em um toque", "O cliente remarca ou cancela pelo próprio link e o horário volta para a agenda na hora."],
  ["Sua cara, suas cores", "Tema do seu nicho, cores e foto de fundo na sua página. Nada de modelo engessado."],
  ["Equipe organizada", "Cada profissional com seus horários, pausas e serviços, tudo num painel só."],
  ["Quanto o app te deu", "Receita que chegou pelo link e atendimentos salvos por remarcação, em reais."],
  ["Instala no celular", "Funciona como app no seu celular, sem baixar nada na loja."],
];

/** Variáveis CSS do tema (usadas pelo landing.css) */
function vars(n: Niche): CSSProperties {
  const c = n.colors;
  return {
    "--lp-bg": c.bg, "--lp-ground": c.ground, "--lp-ink": c.ink, "--lp-muted": c.muted,
    "--lp-accent": c.accent, "--lp-accent-ink": c.accentInk, "--lp-line": c.line,
    "--lp-accent-line": c.accentLine, "--lp-accent-soft": c.accentSoft, "--lp-glow": c.glow,
    "--lp-panel": c.panel, "--lp-panel-strong": c.panelStrong, "--lp-band": c.band,
    "--lp-header": c.headerBg, "--lp-phone": c.phoneBg, "--lp-row": c.rowBg, "--lp-cover": c.cover,
    "--lp-display": n.type.display, "--lp-dw": n.type.weight, "--lp-ds": n.type.style,
    "--lp-dt": n.type.transform, "--lp-dl": n.type.tracking,
  } as CSSProperties;
}

function Check({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--lp-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
  );
}

function Arrow() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  );
}

type Props = {
  initialNiche: NicheId | null;
  priceLabel: string;
  perDayLabel: string;
  trialDays: number;
  noticeDay: number;
  year: number;
};

export function Landing({ initialNiche, priceLabel, perDayLabel, trialDays, noticeDay, year }: Props) {
  const [chosen, setChosen] = useState<NicheId | null>(initialNiche);
  const t = NICHES.find((n) => n.id === chosen) ?? NEUTRAL;
  const cap = t.clientPlural.charAt(0).toUpperCase() + t.clientPlural.slice(1);

  function pick(id: NicheId) {
    setChosen(id);
    // Guarda a escolha no link: dá para compartilhar e o voltar do navegador mantém o tema
    const url = new URL(window.location.href);
    url.searchParams.set("nicho", id);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const steps = [
    { t: "Crie sua página", d: "Cadastre serviços, preços, horários e equipe. Escolha o tema do seu nicho e pronto." },
    { t: "Compartilhe o link", d: `Coloque na bio do Instagram, no WhatsApp e no Google. Seus ${t.clientPlural} marcam sozinhos.` },
    { t: "Acompanhe e cresça", d: "Receba os agendamentos, mande lembretes e veja todo dia quem chamar de volta." },
  ];
  const opps = [
    { n: "2", t: "Horários vagos hoje à tarde", d: "15:30 e 17:00 ainda livres", a: "Divulgar" },
    { n: "3", t: `${cap} sumidos há 45 dias`, d: "Mensagem de volta já pronta", a: "Chamar" },
    { n: "4", t: "Confirmar para amanhã", d: "Lembrete em um toque", a: "Confirmar" },
  ];
  const perks = [
    `${trialDays} dias grátis para testar tudo`,
    `Aviso da primeira cobrança no dia ${noticeDay}`,
    "Agendamentos ilimitados e sem comissão",
    "Profissionais, serviços e clientes sem limite",
    "Cancelamento simples, direto no app",
  ];
  const faq = [
    ["Preciso de cartão para testar?", `Não. Você usa tudo por ${trialDays} dias sem cadastrar cartão. No dia ${noticeDay} avisamos antes de qualquer cobrança.`],
    ["Meu cliente precisa baixar algum app?", "Não. Ele marca pelo seu link, direto no navegador, sem criar conta."],
    ["Vocês cobram comissão por agendamento?", `Não. É um valor fixo de ${priceLabel} por mês, não importa quantos agendamentos você receba.`],
    ["Consigo cancelar quando quiser?", "Sim. O cancelamento é feito no próprio app, em dois toques, sem ligação nem multa."],
    ["Funciona para equipe com vários profissionais?", "Sim. Cada profissional tem seus horários, pausas e serviços, sem limite de pessoas."],
  ];

  return (
    <div className="lp" style={vars(t)}>
      <header className="lp-header">
        <div className="lp-wrap lp-header-row">
          <Link href="/" className="lp-logo" aria-label="Só Marcar, início">
            <span className="lp-logo-mark">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M8.5 13.5l2.5 2.5 4.5-5" /></svg>
            </span>
            Só Marcar
          </Link>
          <nav className="lp-nav" aria-label="Seções">
            <a href="#como">Como funciona</a>
            <a href="#recursos">Recursos</a>
            <a href="#preco">Preço</a>
            <a href="#duvidas">Dúvidas</a>
          </nav>
          <div className="lp-row" style={{ gap: 6 }}>
            <Link href="/entrar" className="lp-btn lp-btn-text">Entrar</Link>
            <Link href={SIGNUP} className="lp-btn lp-btn-primary lp-btn-sm">Testar grátis</Link>
          </div>
        </div>
      </header>

      <main id="topo">
        {chosen === null ? (
          <section className="lp-wrap lp-ask" aria-labelledby="pergunta">
            <span className="lp-badge">Agenda online · {trialDays} dias grátis</span>
            <h1 id="pergunta">Qual é o seu<br /><span className="lp-accent">negócio?</span></h1>
            <p>Escolha abaixo e veja o Só Marcar com a cara do seu espaço: página, agenda e mensagens pensadas para quem você atende.</p>
            <div className="lp-tiles">
              {NICHES.map((n) => (
                <button key={n.id} type="button" className="lp-tile" style={vars(n)} onClick={() => pick(n.id)}>
                  <span className="lp-tile-cover" aria-hidden="true">
                    <span className="lp-tile-word lp-display">{n.tileWord}</span>
                  </span>
                  <span className="lp-tile-body">
                    <span>
                      <span className="lp-tile-name">{n.name}</span>
                      <span className="lp-tile-ex">{n.examples}</span>
                    </span>
                    <span className="lp-round" aria-hidden="true"><Arrow /></span>
                  </span>
                </button>
              ))}
            </div>
            <div className="lp-checks">
              <span><Check size={16} />Sem cartão para começar</span>
              <span><Check size={16} />Sem comissão por agendamento</span>
              <span><Check size={16} />Cancele em dois toques</span>
            </div>
          </section>
        ) : (
          <section className="lp-wrap lp-hero" aria-labelledby="titulo">
            <div className="lp-hero-copy">
              <div className="lp-switch" role="group" aria-label="Seu negócio">
                <span>Seu negócio:</span>
                {NICHES.map((n) => (
                  <button key={n.id} type="button" className="lp-chip" aria-pressed={n.id === chosen} onClick={() => pick(n.id)}>{n.short}</button>
                ))}
              </div>
              <h1 id="titulo" className="lp-display">{t.h1a}<br /><span className="lp-accent">{t.h1b}</span></h1>
              <p>{t.sub}</p>
              <div className="lp-row">
                <Link href={SIGNUP} className="lp-btn lp-btn-primary lp-btn-big">Começar meu mês grátis <Arrow /></Link>
                <a href="#como" className="lp-btn lp-btn-ghost lp-btn-big" style={{ boxShadow: "none" }}>Ver como funciona</a>
              </div>
              <span className="lp-muted" style={{ fontSize: 14 }}>{trialDays} dias grátis, sem cartão. Depois, {priceLabel} por mês e zero comissão.</span>
            </div>

            <div className="lp-phone-area">
              <div className="lp-phone-glow" aria-hidden="true" />
              <div className="lp-phone" role="img" aria-label={`Exemplo da página de agendamento de ${t.bizName}`}>
                <div className="lp-screen" aria-hidden="true">
                  <div className="lp-screen-cover">
                    <span className="lp-screen-kind">{t.bizKind}</span>
                    <span className="lp-screen-name lp-display">{t.bizName}</span>
                  </div>
                  <div className="lp-screen-body">
                    <span className="lp-screen-label">Escolha o serviço</span>
                    {t.services.map(([n, d, p], i) => (
                      <div key={n} className="lp-svc" data-on={i === 0}>
                        <div><b>{n}</b><small>{d}</small></div>
                        <span>{p}</span>
                      </div>
                    ))}
                    <span className="lp-screen-label" style={{ paddingTop: 4 }}>Amanhã, com {t.pro}</span>
                    <div className="lp-slots">
                      {SLOTS.map(([v, s]) => <span key={v} className="lp-slot" data-state={s}>{v}</span>)}
                    </div>
                    <span className="lp-confirm">Confirmar amanhã, 10:30</span>
                  </div>
                </div>
              </div>
              <div className="lp-toast" aria-hidden="true">
                <span className="lp-toast-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                </span>
                <span><b>Novo agendamento</b><small>{t.notice}</small></span>
              </div>
            </div>
          </section>
        )}

        <section id="como" className="lp-band">
          <div className="lp-wrap lp-section">
            <div className="lp-head">
              <span className="lp-eyebrow">Como funciona</span>
              <h2 className="lp-h2 lp-display">Do cadastro ao primeiro {t.clientWord} em minutos.</h2>
            </div>
            <div className="lp-grid">
              {steps.map((s, i) => (
                <div key={s.t} className="lp-card">
                  <span className="lp-step">{i + 1}</span>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-section">
          <div className="lp-head">
            <span className="lp-eyebrow">{t.forWho}</span>
            <h2 className="lp-h2 lp-display">{t.painTitle}</h2>
          </div>
          <div className="lp-grid" style={{ "--lp-min": "420px" } as CSSProperties}>
            <div className="lp-compare lp-compare-before">
              <span className="lp-compare-title">Hoje, sem o Só Marcar</span>
              <ul>
                {t.pains.map((p) => (
                  <li key={p}>
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-compare lp-compare-after">
              <span className="lp-compare-title lp-accent">Com o Só Marcar</span>
              <ul>
                {t.gains.map((g) => <li key={g}><Check size={20} />{g}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section id="recursos" className="lp-wrap lp-split">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span className="lp-eyebrow">Oportunidades de Hoje</span>
            <h2 className="lp-h2 lp-display" style={{ fontSize: "clamp(32px, 4vw, 52px)" }}>Toda manhã, o app diz onde está o dinheiro do dia.</h2>
            <p>Horários vagos para preencher, {t.clientPlural} sumidos para chamar de volta e quem confirmar para amanhã. Um toque abre a conversa no WhatsApp com a mensagem pronta.</p>
          </div>
          <div className="lp-opps" role="img" aria-label="Exemplo da tela Oportunidades de Hoje">
            <div aria-hidden="true" style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingBottom: 6 }}>
              <b style={{ fontSize: 16 }}>Bom dia! Hoje você pode:</b>
              <span className="lp-muted" style={{ fontSize: 12, fontWeight: 700 }}>Exemplo</span>
            </div>
            {opps.map((o) => (
              <div key={o.a} className="lp-opp" aria-hidden="true">
                <span className="lp-opp-n">{o.n}</span>
                <span style={{ flex: 1, minWidth: 0 }}><b>{o.t}</b><small>{o.d}</small></span>
                <span className="lp-opp-a">{o.a}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-wrap" style={{ paddingBottom: 80 }}>
          <div className="lp-grid" style={{ "--lp-min": "260px", gap: 14 } as CSSProperties}>
            {FEATURES.map(([title, d], i) => (
              <div key={title} className="lp-card" style={{ gap: 10, padding: 24 }}>
                <span className="lp-num lp-display">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="preco" className="lp-band" style={{ borderBottom: 0 }}>
          <div className="lp-wrap lp-split" style={{ paddingTop: 80 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <span className="lp-eyebrow">Preço justo</span>
              <h2 className="lp-h2 lp-display">Um valor fixo. Nenhuma comissão.</h2>
              <p>Tem app que fica com uma parte de cada atendimento. Aqui não: quanto mais a sua agenda enche, mais sobra para você. Um {t.clientWord} que volta já paga o mês.</p>
            </div>
            <div className="lp-price" style={{ flex: "0 1 440px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span className="lp-eyebrow" style={{ letterSpacing: "0.14em" }}>Plano único</span>
                <span className="lp-pill">1º mês grátis</span>
              </div>
              <span className="lp-price-value">{priceLabel}<small> /mês</small></span>
              <span className="lp-muted" style={{ fontSize: 15 }}>Cerca de {perDayLabel} por dia.</span>
              <ul className="lp-perks">
                {perks.map((p) => <li key={p}><Check />{p}</li>)}
              </ul>
              <Link href={SIGNUP} className="lp-btn lp-btn-primary lp-btn-big" style={{ marginTop: 10, width: "100%" }}>Começar meu mês grátis</Link>
              <span className="lp-muted" style={{ fontSize: 13, textAlign: "center" }}>Sem cartão para começar. Aviso antes da primeira cobrança.</span>
            </div>
          </div>
        </section>

        <section id="duvidas" className="lp-wrap lp-section lp-faq">
          <h2 className="lp-h2 lp-display" style={{ textAlign: "center", fontSize: "clamp(32px, 4vw, 48px)" }}>Dúvidas frequentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {faq.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lp-accent)" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-wrap" style={{ paddingBottom: 80 }}>
          <div className="lp-final">
            <h2 className="lp-display">{t.cta}</h2>
            <p>Crie sua página hoje e comece a receber agendamentos pelo link.</p>
            <Link href={SIGNUP} className="lp-btn lp-btn-primary lp-btn-big">Começar meu mês grátis</Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-row">
          <span>© {year} Só Marcar</span>
          <nav aria-label="Documentos">
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/termos">Termos de uso</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
