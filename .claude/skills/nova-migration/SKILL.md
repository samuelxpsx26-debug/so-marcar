---
name: nova-migration
description: Cria uma migration nova do Supabase no padrão do Só Marcar, com RLS e teste de banco, e roda npm run test:db. Use para qualquer mudança de tabela, coluna, função ou política.
disable-model-invocation: true
argument-hint: "<nome_curto_em_snake_case> <o que a mudança faz>"
---

# Nova migration

Migrations já existentes em `supabase/migrations/` estão aplicadas em produção: **nunca as altere** (o hook bloqueia). Toda mudança vai num arquivo novo.

1. **Nome do arquivo:** `supabase/migrations/AAAAMMDD0000NN_<nome>.sql`, com a data de hoje e `NN` = próximo número do dia (veja `ls supabase/migrations | tail -3`; se não houver arquivo de hoje, comece em `01`).
2. **Conteúdo**, seguindo o estilo dos arquivos existentes (comentário em pt-BR no topo explicando a regra de negócio):
   - `create table if not exists` / `add column if not exists` para poder reaplicar.
   - Toda tabela de negócio tem `business_id uuid not null references public.businesses(id) on delete cascade`.
   - `alter table ... enable row level security;` e políticas com `public.is_member(business_id)` para leitura e a regra de admin para escrita, como em `20261019000012_club.sql`.
   - Funções `security definer` com `set search_path = public` e checagem de permissão dentro.
3. **Teste:** acrescente asserts em `supabase/tests/db_test.sql` com `pg_temp.as_user(...)` e `pg_temp.assert(...)`, cobrindo o caminho feliz e o isolamento (outro negócio não lê nem escreve).
4. **Rodar:** `npm run test:db` (precisa de Postgres local; use PGHOST/PGPORT/PGUSER). Todos os `ok:` devem aparecer e nenhum `FALHOU`.
5. Se tocar em RLS, webhooks ou pagamentos, peça ao subagente `revisor-seguranca` para revisar.
6. **Produção:** o Claude não aplica a migration no banco de produção. Entregue ao Widney o SQL para colar no SQL Editor do Supabase (projeto omugwhsemfhswhqswxuc) e só publique o código que depende dela depois que ele confirmar.
