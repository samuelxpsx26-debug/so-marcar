-- Só Marcar: estrutura principal (multi-tenant por business_id)
create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- updated_at automático
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Perfis (1:1 com auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Negócios (tenants)
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$'),
  segment text not null default 'outro'
    check (segment in ('barbearia','salao','manicure','estetica','autonomo','personal','estudio','tatuagem','clinica','outro')),
  description text check (char_length(description) <= 1000),
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL' check (currency = 'BRL'),
  phone text,
  whatsapp text,
  email text,
  address jsonb,
  -- Tema escolhido pelo proprietário: cores e imagem de fundo
  theme jsonb not null default '{"primary":"#7c3aed","background":"#0f0f14","text":"#ffffff","image":null}'::jsonb,
  min_notice_minutes integer not null default 60 check (min_notice_minutes between 0 and 10080),
  max_days_ahead integer not null default 60 check (max_days_ahead between 1 and 365),
  slot_step_minutes integer not null default 15 check (slot_step_minutes in (5,10,15,20,30,60)),
  cancel_notice_minutes integer not null default 120 check (cancel_notice_minutes between 0 and 10080),
  cancellation_policy text check (char_length(cancellation_policy) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','professional')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index on public.business_members (user_id);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 500),
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240),
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);
create index on public.services (business_id);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  bio text check (char_length(bio) <= 500),
  avatar_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);
create index on public.professionals (business_id);

create table public.professional_services (
  business_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  primary key (professional_id, service_id),
  foreign key (business_id, professional_id) references public.professionals(business_id, id) on delete cascade,
  foreign key (business_id, service_id) references public.services(business_id, id) on delete cascade
);
create index on public.professional_services (business_id);

-- Faixas de trabalho semanais. Várias faixas no mesmo dia = pausa (ex.: almoço).
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  professional_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (business_id, professional_id) references public.professionals(business_id, id) on delete cascade
);
create index on public.working_hours (professional_id, weekday);

-- Folgas, férias e bloqueios pontuais
create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  professional_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (business_id, professional_id) references public.professionals(business_id, id) on delete cascade
);
create index on public.time_off using gist (professional_id, tstzrange(starts_at, ends_at, '[)'));

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes text check (char_length(notes) <= 2000),
  preferences jsonb not null default '{}'::jsonb,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, phone),
  unique (business_id, id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null,
  service_id uuid not null,
  customer_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- fim real ocupado (inclui intervalo de limpeza/preparo do serviço)
  blocked_until timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('pending','confirmed','cancelled','completed','no_show')),
  source text not null default 'public' check (source in ('public','admin')),
  price_cents integer not null default 0 check (price_cents >= 0),
  notes text check (char_length(notes) <= 1000),
  manage_token uuid not null default gen_random_uuid() unique,
  idempotency_key text,
  rescheduled_from uuid references public.appointments(id) on delete set null,
  cancelled_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (blocked_until >= ends_at),
  unique (business_id, idempotency_key),
  foreign key (business_id, professional_id) references public.professionals(business_id, id),
  foreign key (business_id, service_id) references public.services(business_id, id),
  foreign key (business_id, customer_id) references public.customers(business_id, id),
  -- Garante no banco que o mesmo profissional nunca tem dois horários sobrepostos,
  -- mesmo com duas reservas chegando ao mesmo tempo.
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (status in ('pending','confirmed'))
);
create index on public.appointments (business_id, starts_at);
create index on public.appointments (customer_id);

-- Assinatura do SaaS (1 por negócio)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  plan text not null default 'essencial',
  price_cents integer not null default 3790,
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','canceled','expired')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider text,
  provider_customer_id text,
  provider_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.subscription_events (subscription_id, created_at);

-- Webhooks recebidos (idempotência por provider + event_id)
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')),
  kind text not null check (kind in ('confirmation','reminder','cancellation','reschedule','return_invite','trial_notice')),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (appointment_id, kind, channel)
);
create index on public.notification_jobs (status, scheduled_for);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (business_id, created_at);

-- Triggers de updated_at
do $$
declare t text;
begin
  foreach t in array array['profiles','businesses','services','professionals','customers','appointments','subscriptions'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
