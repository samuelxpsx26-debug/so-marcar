# Só Marcar

Agenda online, lembretes e recuperação de clientes para negócios com hora marcada.
Stack: Next.js 16 (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, RLS) + PWA.

## O que já funciona (MVP)
- Cadastro e login com e-mail/senha, recuperação de senha e botões Google, Facebook e Apple.
- Onboarding em uma tela: o negócio nasce com 30 dias grátis, o dono como profissional e o horário padrão.
- Painel **Hoje**: o benefício financeiro do mês e as **Oportunidades de Hoje** (horários vagos, clientes sumidos, confirmações de amanhã, quem marcar como atendido).
- Agenda por dia (colunas por profissional, com quem está livre agora), semana e mês. Encaixe, atendido/faltou, cancelar, remarcar e adiantar.
- Serviços com duração, intervalo e preço. Equipe com horários, pausa de almoço, serviços que cada um faz, folgas e bloqueios.
- Aparência: o dono escolhe as cores e a imagem de fundo, com prévia ao vivo e alerta de contraste.
- Página pública `/<endereço>`: o cliente agenda sem conta e depois remarca ou cancela pelo próprio link.
- Ajustes: regras de antecedência, política de cancelamento e assinatura com cancelamento em um toque.
- `/admin`: painel do dono do SaaS com MRR, clientes, faturamento dos clientes e ROI/CAC dos anúncios.

## Segurança
- Isolamento por negócio com RLS em todas as tabelas privadas (`supabase/migrations/*_rls.sql`).
- Conflito de horário bloqueado no banco com `EXCLUDE USING gist`, inclusive em requisições simultâneas.
- A reserva pública passa por funções `security definer` que revalidam a disponibilidade, limitam abuso por telefone e não expõem dados de clientes.
- A assinatura só é alterada pelo servidor (service_role). A chave secreta nunca vai para o navegador.

## Rodar localmente
```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev
```

## Banco de dados
1. Crie um projeto no Supabase (região São Paulo).
2. Rode as migrations de `supabase/migrations` em ordem (SQL Editor ou `supabase db push`).
3. Em Authentication > URL Configuration, coloque a URL do site e `https://SEU_SITE/auth/callback` em Redirect URLs.
4. Ative Google, Facebook e Apple em Authentication > Providers e liste-os em `NEXT_PUBLIC_AUTH_PROVIDERS`.

## Testes
```bash
npm test          # regras de negócio (Vitest)
npm run test:db   # banco: RLS, disponibilidade, reservas (precisa de um Postgres local; use PGHOST/PGPORT/PGUSER)
```

## Hospedagem sugerida (plano gratuito)
- **Vercel Hobby** para o app. Atenção: o plano Hobby é para uso não comercial. Ao começar a cobrar clientes, migre para o Pro (US$ 20/mês) ou use Cloudflare/Netlify.
- **Supabase Free**: 500 MB de banco e 50 mil usuários ativos por mês. Projetos parados por 7 dias são pausados, então suba para o Pro (US$ 25/mês) antes do lançamento.

## Próximos passos
- Envio dos e-mails de confirmação e lembrete (fila `notification_jobs` já criada; falta o worker e o provedor, ex.: Resend).
- Cobrança recorrente de R$ 37,90 com aviso no dia 25 (Mercado Pago ou Asaas, via webhook em `webhook_events`).
- Upload de imagem de fundo e logo (Supabase Storage).
- Fase 2: WhatsApp oficial, lista de espera, sinal via Pix, pacotes e fidelidade.
