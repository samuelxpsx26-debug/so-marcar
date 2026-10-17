import Link from "next/link";
import { Logo } from "@/components/logo";
import { brl, pricePerDay, PLAN_PRICE_CENTS } from "@/lib/format";

const niches = ["Barbearias", "Salões", "Manicures", "Estética", "Personal trainers", "Estúdios", "Tatuadores", "Autônomos"];

const features = [
  { t: "Agenda aberta 24 horas", d: "Seu cliente escolhe o serviço, o profissional e o horário pelo link, sem precisar de conta. Horário ocupado não aparece duas vezes." },
  { t: "Oportunidades de Hoje", d: "Toda manhã o app mostra o que fazer: horários vagos para preencher, clientes sumidos para chamar e quem confirmar para amanhã." },
  { t: "Remarcação em um toque", d: "Imprevisto acontece. O cliente remarca ou cancela pelo próprio link e o horário volta para a agenda na hora." },
  { t: "Sua cara, suas cores", d: "Você escolhe as cores e a imagem de fundo da sua página. Nada de modelo engessado." },
  { t: "Equipe organizada", d: "Cada profissional com seus horários, pausas e serviços. Fica fácil ver quem tem horário vago." },
  { t: "Quanto o app te deu", d: "O painel mostra a receita que chegou pelo link e os atendimentos salvos por remarcação. Você vê o retorno em reais." },
];

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/entrar" className="btn btn-ghost px-3 py-2">Entrar</Link>
          <Link href="/entrar?modo=cadastro" className="btn btn-primary px-3 py-2">Testar grátis</Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-16">
        <div className="pointer-events-none absolute -top-24 right-0 -z-10 h-80 w-80 rounded-full bg-violet-300/40 blur-3xl" />
        <p className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">1º mês grátis · sem comissão por agendamento</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          Sua agenda cheia, <span className="text-brand">sem ficar no WhatsApp</span> o dia inteiro.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          O Só Marcar recebe agendamentos pelo seu link, lembra seus clientes e mostra todo dia quem chamar para voltar.
          Por <strong className="text-ink">{pricePerDay()} por dia</strong>.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/entrar?modo=cadastro" className="btn btn-primary px-6 py-4 text-base">Começar meu mês grátis</Link>
          <a href="#como-funciona" className="btn btn-ghost px-6 py-4 text-base">Ver como funciona</a>
        </div>
        <p className="mt-3 text-sm text-muted">Sem cartão para começar. Cancele quando quiser, em dois toques.</p>
        <div className="mt-10 flex flex-wrap gap-2">
          {niches.map((n) => (
            <span key={n} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm">{n}</span>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="bg-zinc-950 py-16 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Um assistente de crescimento, não só uma agenda</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.t} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-lg font-semibold">{f.t}</h3>
                <p className="mt-2 text-sm text-zinc-300">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mx-auto max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-xl shadow-violet-200/50">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">Plano único</p>
          <p className="mt-3 text-5xl font-extrabold">{brl(PLAN_PRICE_CENTS)}<span className="text-lg font-medium text-muted">/mês</span></p>
          <p className="mt-2 text-muted">Menos de {pricePerDay()} por dia. Um cliente que volta já paga o mês.</p>
          <ul className="mt-6 space-y-2 text-left text-sm">
            {["30 dias grátis para testar tudo", "Aviso da primeira cobrança no dia 25, sem surpresa", "Agendamentos ilimitados e sem comissão", "Profissionais, serviços e clientes sem limite", "Cancelamento simples, direto no app"].map((i) => (
              <li key={i} className="flex gap-2"><span className="text-good">✓</span>{i}</li>
            ))}
          </ul>
          <Link href="/entrar?modo=cadastro" className="btn btn-primary mt-8 w-full py-4 text-base">Começar grátis</Link>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        <Logo className="text-ink" />
        <p className="mt-2">© {new Date().getFullYear()} Só Marcar</p>
      </footer>
    </main>
  );
}
