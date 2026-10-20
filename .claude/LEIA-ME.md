# Automações do Claude Code neste projeto

- **Hooks** (`settings.json` + `hooks/`):
  - pede confirmação antes de `git push` para a `main` (o que vai para a main entra no site);
  - bloqueia edição de arquivos `.env` e de migrations que já estão no repositório;
  - depois de editar `.ts`/`.tsx` em `src/`, roda `eslint --fix` e `tsc --noEmit` e devolve os erros ao Claude.
- **Subagentes** (`agents/`): `revisor-seguranca` (RLS, webhooks, pagamentos, segredos) e `checador-next16` (consulta a documentação local do Next.js 16).
- **Skill** (`skills/nova-migration`): `/nova-migration <nome> <o que faz>` cria a migration no padrão, com RLS e teste, e roda `npm run test:db`.
- **MCPs** (`../.mcp.json`):
  - `vercel`: na primeira vez, o Claude Code abre o login da Vercel no navegador.
  - `supabase` (somente leitura, projeto omugwhsemfhswhqswxuc): precisa da variável `SUPABASE_ACCESS_TOKEN` com um token pessoal criado em supabase.com/dashboard/account/tokens. Coloque o token na sua máquina ou nas variáveis do ambiente do Claude Code; nunca no chat nem no repositório.
