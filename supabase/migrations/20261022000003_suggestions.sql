-- Sugestões dos lojistas (área Aprender). Quem é da equipe envia e vê as próprias;
-- o dono do Só Marcar lê todas no /admin pelo servidor (service_role).
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 5 and 1000),
  page text check (char_length(page) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists suggestions_created_idx on public.suggestions (created_at desc);

alter table public.suggestions enable row level security;
drop policy if exists suggestions_insert_own on public.suggestions;
create policy suggestions_insert_own on public.suggestions for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(business_id));
drop policy if exists suggestions_select_own on public.suggestions;
create policy suggestions_select_own on public.suggestions for select to authenticated
  using (user_id = auth.uid());

revoke all on public.suggestions from anon;
grant select, insert on public.suggestions to authenticated;
grant all on public.suggestions to service_role;
