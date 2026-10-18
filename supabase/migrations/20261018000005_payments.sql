-- Pagamentos, em duas partes que nunca se misturam:
--   1. Assinatura do SaaS: o estabelecimento paga a plataforma (Stripe Billing).
--   2. Pagamentos de serviços: o cliente final paga o estabelecimento, na conta
--      do próprio estabelecimento (Asaas / Mercado Pago). Sem split e sem comissão.

-- ===== 1. Assinatura do SaaS =====

-- Planos: preço, moeda e dias grátis ficam aqui, não no código
create table public.plans (
  id text primary key check (id ~ '^[a-z0-9_-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  billing_interval text not null default 'month' check (billing_interval in ('month','year')),
  trial_days integer not null default 30 check (trial_days between 0 and 90),
  -- Opcional: Price criado no painel da Stripe. Sem ele, o checkout usa price_cents acima.
  stripe_price_id text,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index plans_single_default on public.plans (is_default) where is_default;
insert into public.plans (id, name, price_cents, trial_days, is_default) values ('essencial', 'Essencial', 3790, 30, true);

alter table public.subscriptions
  add constraint subscriptions_plan_fkey foreign key (plan) references public.plans(id),
  add column provider_status text,
  add column canceled_at timestamptz,
  add column last_payment_error text check (char_length(last_payment_error) <= 300),
  -- Momento em que o estado foi lido do provedor (evita que um webhook atrasado sobrescreva um mais novo)
  add column provider_synced_at timestamptz not null default 'epoch';
create index on public.subscriptions (provider, provider_customer_id);

alter table public.webhook_events
  add column event_type text,
  add column attempts integer not null default 0;

-- ===== 2. Pagamentos de serviços (cliente -> estabelecimento) =====

-- Conta do estabelecimento num provedor. Status 'connected' só depois de validar as credenciais.
create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null check (provider in ('asaas','mercadopago')),
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  status text not null default 'pending' check (status in ('pending','connected','disabled','error')),
  external_account_id text,
  display_name text check (char_length(display_name) <= 120),
  last_error text check (char_length(last_error) <= 300),
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider, environment),
  unique (business_id, id)
);

-- Credenciais criptografadas (AES-256-GCM, chave só no servidor). Ninguém além do service_role lê.
create table public.payment_account_secrets (
  payment_account_id uuid primary key references public.payment_accounts(id) on delete cascade,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

-- Cobrança de um serviço. Nunca guarda dados de cartão: só identificadores e status do provedor.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  payment_account_id uuid not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid,
  provider text not null check (provider in ('asaas','mercadopago')),
  environment text not null check (environment in ('sandbox','production')),
  purpose text not null default 'deposit' check (purpose in ('deposit','full','other')),
  method text not null check (method in ('pix','card','boleto')),
  status text not null default 'pending' check (status in ('pending','paid','refunded','canceled','failed','expired')),
  provider_status text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  external_id text,
  checkout_url text,
  pix_copy_paste text,
  expires_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  provider_synced_at timestamptz not null default 'epoch',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id),
  foreign key (business_id, payment_account_id) references public.payment_accounts(business_id, id),
  foreign key (business_id, customer_id) references public.customers(business_id, id)
);
create index on public.payments (business_id, created_at);
create index on public.payments (appointment_id);

-- Histórico para conciliação
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.payment_events (payment_id, created_at);

do $$
declare t text;
begin
  foreach t in array array['plans','payment_accounts','payment_account_secrets','payments'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ===== RLS =====
alter table public.plans enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.payment_account_secrets enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;

create policy plans_public_select on public.plans for select to anon, authenticated using (active);
create policy payment_accounts_admin_select on public.payment_accounts for select to authenticated
  using (public.has_role(business_id, array['owner','admin']));
create policy payments_admin_select on public.payments for select to authenticated
  using (public.has_role(business_id, array['owner','admin']));
create policy payment_events_admin_select on public.payment_events for select to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id and public.has_role(p.business_id, array['owner','admin'])));
-- payment_account_secrets: sem política = só o service_role

-- Escrita só pelo servidor (service_role)
revoke all on public.plans, public.payment_accounts, public.payment_account_secrets, public.payments, public.payment_events from anon, authenticated;
grant select on public.plans to anon, authenticated;
grant select on public.payment_accounts, public.payments, public.payment_events to authenticated;
grant all on public.plans, public.payment_accounts, public.payment_account_secrets, public.payments, public.payment_events to service_role;

create or replace function public.create_business(
  p_name text, p_slug text, p_segment text default 'outro', p_timezone text default 'America/Sao_Paulo'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_pro uuid; v_name text;
begin
  if v_uid is null then raise exception 'Faça login para continuar' using errcode = '42501'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Fuso horário inválido' using errcode = '22023';
  end if;
  if (select count(*) from public.business_members where user_id = v_uid and role = 'owner') >= 3 then
    raise exception 'Limite de negócios atingido' using errcode = '54000';
  end if;

  insert into public.businesses (name, slug, segment, timezone, created_by)
  values (trim(p_name), lower(trim(p_slug)), p_segment, p_timezone, v_uid)
  returning id into v_id;

  insert into public.business_members (business_id, user_id, role) values (v_id, v_uid, 'owner');

  -- Plano, preço e dias grátis vêm da tabela plans (plano padrão)
  insert into public.subscriptions (business_id, plan, price_cents, status, trial_ends_at)
  select v_id, p.id, p.price_cents, 'trialing', now() + make_interval(days => p.trial_days)
  from public.plans p where p.is_default and p.active;
  if not found then raise exception 'Nenhum plano padrão ativo' using errcode = 'P0002'; end if;

  select coalesce(full_name, split_part(u.email, '@', 1), 'Profissional') into v_name
  from auth.users u left join public.profiles p on p.id = u.id where u.id = v_uid;

  insert into public.professionals (business_id, user_id, name)
  values (v_id, v_uid, left(coalesce(v_name, 'Profissional'), 120)) returning id into v_pro;

  -- Horário padrão: seg a sex 09-12 e 13-18 (almoço livre), sáb 09-13
  insert into public.working_hours (business_id, professional_id, weekday, start_time, end_time)
  select v_id, v_pro, d, time '09:00', time '12:00' from generate_series(1, 5) d
  union all
  select v_id, v_pro, d, time '13:00', time '18:00' from generate_series(1, 5) d
  union all
  select v_id, v_pro, 6, time '09:00', time '13:00';

  insert into public.audit_logs (business_id, actor_id, action, entity, entity_id)
  values (v_id, v_uid, 'business.created', 'business', v_id);
  return v_id;
exception when unique_violation then
  raise exception 'Esse endereço já está em uso, escolha outro' using errcode = '23505';
end $$;
