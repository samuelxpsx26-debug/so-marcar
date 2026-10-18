-- Testes do banco: isolamento entre negócios, disponibilidade e reservas.
-- Rodar com: npm run test:db  (precisa de um Postgres local, ver README)
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
  if p is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

create temp table ctx (k text primary key, v text);
grant all on ctx to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@teste.com', '{"full_name":"Ana Barbeira"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bruno@teste.com', '{"full_name":"Bruno Estética"}');

set client_min_messages = notice;

-- Ana cria a barbearia
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into ctx values ('biz_a', public.create_business('Barbearia da Ana', 'barbearia-ana', 'barbearia'));
insert into public.services (business_id, name, duration_minutes, buffer_minutes, price_cents)
  select v::uuid, 'Corte', 30, 10, 4000 from ctx where k = 'biz_a';
insert into public.customers (business_id, name, phone)
  select v::uuid, 'Cliente Secreto', '5511988887777' from ctx where k = 'biz_a';
select pg_temp.assert((select count(*) from public.professionals) = 1, 'negócio nasce com o dono como profissional');
select pg_temp.assert((select status from public.subscriptions) = 'trialing', 'negócio nasce em teste grátis');
select pg_temp.assert((select trial_ends_at::date from public.subscriptions) = (now() + interval '30 days')::date, 'teste grátis de 30 dias');

-- Bruno cria o dele e tenta mexer no da Ana
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into ctx values ('biz_b', public.create_business('Estética do Bruno', 'estetica-bruno', 'estetica'));
select pg_temp.assert((select count(*) from public.businesses) = 1, 'Bruno só vê o próprio negócio');
select pg_temp.assert((select count(*) from public.customers) = 0, 'Bruno não vê clientes da Ana');
select pg_temp.assert((select count(*) from public.services) = 0, 'Bruno não vê serviços da Ana');

do $$
begin
  insert into public.services (business_id, name, duration_minutes) select v::uuid, 'Invasão', 30 from ctx where k = 'biz_a';
  raise exception 'FALHOU: Bruno conseguiu criar serviço no negócio da Ana';
exception when insufficient_privilege then raise notice 'ok: Bruno não cria serviço no negócio da Ana';
end $$;

do $$
declare n int;
begin
  update public.businesses set name = 'Hackeado' where id = (select v::uuid from ctx where k = 'biz_a');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: Bruno alterou negócio da Ana'; end if;
  raise notice 'ok: Bruno não altera negócio da Ana';
end $$;

do $$
begin
  insert into public.business_members (business_id, user_id, role)
  select v::uuid, '00000000-0000-0000-0000-00000000000b', 'admin' from ctx where k = 'biz_a';
  raise exception 'FALHOU: Bruno se adicionou na equipe da Ana';
exception when insufficient_privilege then raise notice 'ok: Bruno não entra na equipe da Ana';
end $$;

do $$
begin
  update public.subscriptions set status = 'active';
  raise exception 'FALHOU: usuário alterou a própria assinatura';
exception when insufficient_privilege then raise notice 'ok: usuário não altera a assinatura pelo navegador';
end $$;

-- Visitante anônimo
select pg_temp.as_user(null);
do $$
begin
  perform count(*) from public.customers;
  raise exception 'FALHOU: anônimo leu clientes';
exception when insufficient_privilege then raise notice 'ok: anônimo não lê tabelas';
end $$;

-- Próxima segunda-feira no fuso do negócio
insert into ctx select 'day', ((now() at time zone 'America/Sao_Paulo')::date
  + ((8 - extract(dow from (now() at time zone 'America/Sao_Paulo'))::int) % 7 + 7))::text;

select pg_temp.assert((public.get_public_business('barbearia-ana')->'services'->0->>'name') = 'Corte', 'página pública mostra o serviço');
select pg_temp.assert(public.get_public_business('barbearia-ana')::text not like '%Cliente Secreto%', 'página pública não expõe clientes');

insert into ctx select 'svc', (public.get_public_business('barbearia-ana')->'services'->0->>'id');
insert into ctx select 'pro', (public.get_public_business('barbearia-ana')->'professionals'->0->>'id');

-- 09:00-12:00 e 13:00-18:00, corte 30 + 10 de intervalo, passo 15 => 9:00..11:15 (10) + 13:00..17:15 (18)
select pg_temp.assert(
  (select count(*) from public.get_available_slots('barbearia-ana', (select v::uuid from ctx where k='svc'), (select v::date from ctx where k='day'))) = 28,
  'segunda tem 28 horários (respeita almoço e intervalo)');
select pg_temp.assert(
  not exists (select 1 from public.get_available_slots('barbearia-ana', (select v::uuid from ctx where k='svc'), (select v::date from ctx where k='day')) x
    where (x.starts_at at time zone 'America/Sao_Paulo')::time between '11:21' and '12:59'),
  'nenhum horário invade o almoço');
select pg_temp.assert(
  (select count(*) from public.get_available_slots('barbearia-ana', (select v::uuid from ctx where k='svc'), (select v::date - 1 from ctx where k='day'))) = 0,
  'domingo sem expediente não tem horários');

-- Reserva pública às 10:00
insert into ctx select 'start', (((select v::date from ctx where k='day') + time '10:00')::timestamp at time zone 'America/Sao_Paulo')::text;
insert into ctx select 'booking', public.create_public_booking('barbearia-ana', (select v::uuid from ctx where k='svc'),
  (select v::uuid from ctx where k='pro'), (select v::timestamptz from ctx where k='start'),
  'João Cliente', '(11) 97777-6666', 'joao@teste.com', 'idem-1')::text;
select pg_temp.assert((select v::jsonb ? 'manage_token' from ctx where k='booking'), 'cliente reserva sem criar conta');

select pg_temp.assert(
  (public.create_public_booking('barbearia-ana', (select v::uuid from ctx where k='svc'), (select v::uuid from ctx where k='pro'),
    (select v::timestamptz from ctx where k='start'), 'João Cliente', '11977776666', null, 'idem-1')->>'id')
  = (select v::jsonb->>'id' from ctx where k='booking'),
  'reenvio com a mesma chave não duplica a reserva');

do $$
begin
  perform public.create_public_booking('barbearia-ana', (select v::uuid from ctx where k='svc'), (select v::uuid from ctx where k='pro'),
    (select v::timestamptz from ctx where k='start'), 'Maria', '11966665555');
  raise exception 'FALHOU: horário reservado duas vezes';
exception when exclusion_violation then raise notice 'ok: mesmo horário não pode ser reservado de novo';
end $$;

do $$
begin
  -- 10:30 cai dentro do intervalo de 10 min após o corte das 10:00 (termina 10:40)
  perform public.create_public_booking('barbearia-ana', (select v::uuid from ctx where k='svc'), (select v::uuid from ctx where k='pro'),
    (select v::timestamptz + interval '30 minutes' from ctx where k='start'), 'Maria', '11966665555');
  raise exception 'FALHOU: reserva invadiu o intervalo do serviço';
exception when exclusion_violation then raise notice 'ok: intervalo entre atendimentos é respeitado';
end $$;

-- A trava do banco segura mesmo quem tenta inserir direto (simula corrida)
reset role;
do $$
begin
  insert into public.appointments (business_id, professional_id, service_id, customer_id, starts_at)
  select a.business_id, a.professional_id, a.service_id, a.customer_id, a.starts_at + interval '5 minutes'
  from public.appointments a limit 1;
  raise exception 'FALHOU: banco aceitou sobreposição';
exception when exclusion_violation then raise notice 'ok: banco bloqueia sobreposição mesmo sem passar pela tela';
end $$;
select pg_temp.as_user(null);

select pg_temp.assert(
  (select count(*) from public.get_available_slots('barbearia-ana', (select v::uuid from ctx where k='svc'), (select v::date from ctx where k='day'))) = 23,
  'horário reservado (e vizinhos) somem da lista');

-- Remarcar pelo link
insert into ctx select 'resched', public.reschedule_booking_by_token((select (v::jsonb->>'manage_token')::uuid from ctx where k='booking'),
  (select v::timestamptz + interval '4 hours' from ctx where k='start'))::text;
select pg_temp.assert(
  (public.get_booking_by_token((select (v::jsonb->>'manage_token')::uuid from ctx where k='booking'))->>'status') = 'cancelled',
  'remarcação libera o horário antigo');
select pg_temp.assert(
  (public.get_booking_by_token((select (v::jsonb->>'manage_token')::uuid from ctx where k='resched'))->>'status') = 'confirmed',
  'remarcação cria o novo horário');

-- Cancelar pelo link
select public.cancel_booking_by_token((select (v::jsonb->>'manage_token')::uuid from ctx where k='resched'), 'imprevisto');
select pg_temp.assert(
  (public.get_booking_by_token((select (v::jsonb->>'manage_token')::uuid from ctx where k='resched'))->>'status') = 'cancelled',
  'cliente cancela pelo link');

-- Ana vê tudo no painel dela
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.appointments) = 2, 'dona vê as reservas do negócio');
select pg_temp.assert((select count(*) from public.customers) = 2, 'dona vê os clientes, inclusive o novo');

-- Teste grátis vencido bloqueia a agenda pública
reset role;
update public.subscriptions set trial_ends_at = now() - interval '1 day'
  where business_id = (select v::uuid from ctx where k = 'biz_a');
select pg_temp.as_user(null);
do $$
begin
  perform public.create_public_booking('barbearia-ana', (select v::uuid from ctx where k='svc'), (select v::uuid from ctx where k='pro'),
    (select v::timestamptz from ctx where k='start'), 'Maria', '11966665555');
  raise exception 'FALHOU: reservou com teste vencido';
exception when no_data_found then raise notice 'ok: teste vencido pausa a agenda pública';
end $$;

-- Pagamentos: plano vem da tabela, segredos e escrita só pelo servidor
reset role;
select pg_temp.assert((select plan || ':' || price_cents from public.subscriptions where business_id = (select v::uuid from ctx where k = 'biz_a')) = 'essencial:3790',
  'assinatura nasce com o plano padrão');
insert into public.payment_accounts (id, business_id, provider, status) values ('00000000-0000-0000-0000-0000000000f1', (select v::uuid from ctx where k = 'biz_a'), 'asaas', 'connected');
insert into public.payment_account_secrets values ('00000000-0000-0000-0000-0000000000f1', 'cifrado');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.payment_accounts) = 1, 'dona vê a conta de pagamento');
select pg_temp.assert((select count(*) from public.plans) = 1, 'planos são públicos');
do $$ begin
  perform * from public.payment_account_secrets;
  raise exception 'FALHOU: dona leu credenciais';
exception when insufficient_privilege then raise notice 'ok: credenciais só no servidor';
end $$;
do $$ begin
  insert into public.payments (business_id, payment_account_id, provider, environment, method, amount_cents)
  values ((select business_id from public.payment_accounts limit 1), '00000000-0000-0000-0000-0000000000f1', 'asaas', 'sandbox', 'pix', 1000);
  raise exception 'FALHOU: painel criou pagamento direto';
exception when insufficient_privilege then raise notice 'ok: pagamentos só pelo servidor';
end $$;
do $$ begin
  update public.subscriptions set status = 'active';
  raise exception 'FALHOU: painel ativou a própria assinatura';
exception when insufficient_privilege then raise notice 'ok: assinatura só muda pelo servidor';
end $$;
reset role;
\echo 'TODOS OS TESTES DO BANCO PASSARAM'
