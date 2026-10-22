-- Financeiro do dono: gastos avulsos, gastos fixos mensais, regras de comissão e comissões pagas.
-- O lucro real do mês = faturamento − comissões − gastos fixos − gastos avulsos (calculado no app).
-- Tudo aqui é visível e editável só pelo dono (role owner): nem administradores nem profissionais veem.

-- Gastos avulsos: gasolina, café para clientes, um anúncio, um produto...
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null check (char_length(category) between 2 and 40),
  description text check (char_length(description) <= 120),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  spent_on date not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists expenses_business_day on public.expenses (business_id, spent_on);

-- Gastos fixos: entram sozinhos em todo mês de starts_on até ends_on (vazio = sem fim). Datas sempre no dia 1.
create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null check (char_length(category) between 2 and 40),
  description text check (char_length(description) <= 120),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  starts_on date not null check (extract(day from starts_on) = 1),
  ends_on date check (ends_on is null or (extract(day from ends_on) = 1 and ends_on >= starts_on)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fixed_expenses_business on public.fixed_expenses (business_id);

-- Comissão de cada profissional: % do valor do atendimento ou valor fixo (centavos) por atendimento.
-- service_id vazio = regra geral do profissional; preenchido = vale só para aquele serviço (tem prioridade).
create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null,
  service_id uuid,
  mode text not null check (mode in ('percent', 'fixed')),
  value integer not null check (value >= 0 and ((mode = 'percent' and value <= 10000) or (mode = 'fixed' and value <= 10000000))), -- percent em centésimos (4050 = 40,5%)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, professional_id) references public.professionals(business_id, id) on delete cascade,
  foreign key (business_id, service_id) references public.services(business_id, id) on delete cascade
);
create unique index if not exists commission_rules_general on public.commission_rules (professional_id) where service_id is null;
create unique index if not exists commission_rules_service on public.commission_rules (professional_id, service_id) where service_id is not null;
create index if not exists commission_rules_business on public.commission_rules (business_id);

-- Comissões pagas: o dono marca o mês de um profissional como pago (valor que pagou).
create table if not exists public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null,
  month date not null check (extract(day from month) = 1),
  amount_cents integer not null check (amount_cents >= 0),
  paid_at timestamptz not null default now(),
  foreign key (business_id, professional_id) references public.professionals(business_id, id) on delete cascade,
  unique (professional_id, month)
);
create index if not exists commission_payouts_business on public.commission_payouts (business_id, month);

drop trigger if exists set_updated_at on public.fixed_expenses;
create trigger set_updated_at before update on public.fixed_expenses for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.commission_rules;
create trigger set_updated_at before update on public.commission_rules for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commission_payouts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['expenses','fixed_expenses','commission_rules','commission_payouts'] loop
    execute format('drop policy if exists %1$s_owner_all on public.%1$I', t);
    execute format('create policy %1$s_owner_all on public.%1$I for all to authenticated using (public.has_role(business_id, array[''owner''])) with check (public.has_role(business_id, array[''owner'']))', t);
  end loop;
end $$;

grant select, insert, update, delete on public.expenses, public.fixed_expenses, public.commission_rules, public.commission_payouts to authenticated;
grant all on public.expenses, public.fixed_expenses, public.commission_rules, public.commission_payouts to service_role;
