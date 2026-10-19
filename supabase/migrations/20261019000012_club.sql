-- Clube mensal: o cliente assina um plano (ex.: "4 cortes por mês por R$ 120") e paga a mensalidade direto ao dono.
-- Cada mensalidade recebida libera um período de 1 mês; dentro dele o cliente usa até N atendimentos sem pagar avulso.

create table if not exists public.club_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  price_cents integer not null check (price_cents > 0),
  sessions_per_month integer check (sessions_per_month between 1 and 60), -- vazio = ilimitado
  service_ids uuid[] not null default '{}', -- vazio = todos os serviços
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  plan_id uuid references public.club_plans(id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  price_cents integer not null check (price_cents > 0),
  sessions_per_month integer check (sessions_per_month between 1 and 60),
  service_ids uuid[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'cancelled')),
  started_on date not null,
  paid_until date,
  cancelled_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, customer_id) references public.customers(business_id, id) on delete cascade
);
create index if not exists club_members_customer on public.club_members (business_id, customer_id);
create unique index if not exists club_members_one_active on public.club_members (business_id, customer_id) where status = 'active';

create table if not exists public.club_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid not null,
  amount_cents integer not null check (amount_cents >= 0),
  period_start date not null,
  period_end date not null,
  paid_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (period_end > period_start),
  foreign key (business_id, member_id) references public.club_members(business_id, id) on delete cascade
);
create index if not exists club_payments_member on public.club_payments (member_id, period_start);
create index if not exists club_payments_paid on public.club_payments (business_id, paid_at);

alter table public.appointments add column if not exists club_member_id uuid references public.club_members(id) on delete set null;

drop trigger if exists set_updated_at on public.club_plans;
create trigger set_updated_at before update on public.club_plans for each row execute function public.set_updated_at();

alter table public.club_plans enable row level security;
alter table public.club_members enable row level security;
alter table public.club_payments enable row level security;

drop policy if exists club_plans_member_select on public.club_plans;
create policy club_plans_member_select on public.club_plans for select to authenticated using (public.is_member(business_id));
drop policy if exists club_plans_admin_write on public.club_plans;
create policy club_plans_admin_write on public.club_plans for all to authenticated
  using (public.has_role(business_id, array['owner','admin'])) with check (public.has_role(business_id, array['owner','admin']));
drop policy if exists club_members_member_all on public.club_members;
create policy club_members_member_all on public.club_members for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));
drop policy if exists club_payments_member_select on public.club_payments;
create policy club_payments_member_select on public.club_payments for select to authenticated using (public.is_member(business_id));

grant select, insert, update, delete on public.club_plans, public.club_members to authenticated;
grant select on public.club_payments to authenticated;
grant all on public.club_plans, public.club_members, public.club_payments to service_role;

-- Mensalidade recebida: libera o próximo mês. Em dia, emenda no período anterior; muito atrasada (mais de 30 dias), recomeça hoje.
create or replace function public.record_club_payment(p_member uuid) returns date
language plpgsql security definer set search_path = public as $$
declare m public.club_members%rowtype; v_today date; v_start date;
begin
  select * into m from public.club_members where id = p_member for update;
  if not found or not public.is_member(m.business_id) then raise exception 'Assinatura não encontrada' using errcode = 'P0002'; end if;
  if m.status <> 'active' then raise exception 'Essa assinatura foi cancelada' using errcode = '22023'; end if;
  select (now() at time zone b.timezone)::date into v_today from public.businesses b where b.id = m.business_id;
  v_start := case when m.paid_until is null or m.paid_until < v_today - 30 then v_today else m.paid_until end;
  insert into public.club_payments (business_id, member_id, amount_cents, period_start, period_end)
  values (m.business_id, m.id, m.price_cents, v_start, (v_start + interval '1 month')::date);
  update public.club_members set paid_until = (v_start + interval '1 month')::date where id = m.id;
  insert into public.audit_logs (business_id, actor_id, action, entity, entity_id, data)
  values (m.business_id, auth.uid(), 'club.payment', 'club_member', m.id, jsonb_build_object('period_start', v_start));
  return (v_start + interval '1 month')::date;
end $$;

-- Assinar o clube (com a 1ª mensalidade já recebida, se for o caso)
create or replace function public.subscribe_club(p_customer uuid, p_plan uuid, p_paid boolean default true) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.customers%rowtype; k public.club_plans%rowtype; v_id uuid; v_today date;
begin
  select * into c from public.customers where id = p_customer;
  if not found or not public.is_member(c.business_id) then raise exception 'Cliente não encontrado' using errcode = 'P0002'; end if;
  select * into k from public.club_plans where id = p_plan and business_id = c.business_id and active;
  if not found then raise exception 'Plano não encontrado' using errcode = 'P0002'; end if;
  if exists (select 1 from public.club_members where business_id = c.business_id and customer_id = c.id and status = 'active') then
    raise exception 'Esse cliente já está no clube' using errcode = '22023';
  end if;
  select (now() at time zone b.timezone)::date into v_today from public.businesses b where b.id = c.business_id;
  insert into public.club_members (business_id, customer_id, plan_id, name, price_cents, sessions_per_month, service_ids, started_on)
  values (c.business_id, c.id, k.id, k.name, k.price_cents, k.sessions_per_month, k.service_ids, v_today)
  returning id into v_id;
  if p_paid then perform public.record_club_payment(v_id); end if;
  return v_id;
end $$;

-- Período pago que cobre um dia (o mês do clube em que o atendimento cai)
create or replace function public.club_period(p_member uuid, p_day date) returns public.club_payments
language sql stable security definer set search_path = public as $$
  select * from public.club_payments where member_id = p_member and period_start <= p_day and period_end > p_day
  order by paid_at desc limit 1
$$;

-- Atendimento coberto pelo clube: marca como atendido, sem valor (já entra na mensalidade)
create or replace function public.use_club_session(p_appointment uuid, p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.appointments%rowtype; m public.club_members%rowtype; per public.club_payments%rowtype; v_day date; v_used int;
begin
  select * into a from public.appointments where id = p_appointment for update;
  if not found or not public.is_member(a.business_id) then raise exception 'Atendimento não encontrado' using errcode = 'P0002'; end if;
  if a.club_member_id is not null or a.customer_package_id is not null then raise exception 'Esse atendimento já foi pago com clube ou pacote' using errcode = '22023'; end if;
  if a.status in ('cancelled','no_show') then raise exception 'Esse atendimento não pode usar o clube' using errcode = '22023'; end if;
  select * into m from public.club_members where id = p_member and business_id = a.business_id for update;
  if not found or m.customer_id <> a.customer_id then raise exception 'Assinatura não encontrada para esse cliente' using errcode = 'P0002'; end if;
  if m.status <> 'active' then raise exception 'Essa assinatura foi cancelada' using errcode = '22023'; end if;
  if cardinality(m.service_ids) > 0 and not (a.service_id = any(m.service_ids)) then raise exception 'Esse serviço não está no plano do clube' using errcode = '22023'; end if;
  select (a.starts_at at time zone b.timezone)::date into v_day from public.businesses b where b.id = a.business_id;
  per := public.club_period(m.id, v_day);
  if per.id is null then raise exception 'A mensalidade desse mês não foi registrada. Toque em "Mensalidade recebida" em Clientes primeiro.' using errcode = '22023'; end if;
  if m.sessions_per_month is not null then
    select count(*) into v_used from public.appointments x join public.businesses b on b.id = x.business_id
    where x.club_member_id = m.id and (x.starts_at at time zone b.timezone)::date >= per.period_start and (x.starts_at at time zone b.timezone)::date < per.period_end;
    if v_used >= m.sessions_per_month then raise exception 'O cliente já usou todos os atendimentos do clube neste mês' using errcode = '22023'; end if;
  end if;
  update public.appointments set status = 'completed', price_cents = 0, club_member_id = m.id where id = a.id;
  insert into public.audit_logs (business_id, actor_id, action, entity, entity_id, data)
  values (a.business_id, auth.uid(), 'club.session_used', 'appointment', a.id, jsonb_build_object('member', m.id));
end $$;

create or replace function public.get_public_business(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'slug', b.slug, 'segment', b.segment, 'description', b.description,
    'timezone', b.timezone, 'whatsapp', b.whatsapp, 'phone', b.phone, 'address', b.address,
    'theme', b.theme, 'cancellation_policy', b.cancellation_policy,
    'max_days_ahead', b.max_days_ahead, 'cancel_notice_minutes', b.cancel_notice_minutes,
    'deposit', jsonb_build_object('mode', b.deposit_mode, 'value', b.deposit_value, 'hold_minutes', b.deposit_hold_minutes),
    'active', public.business_is_active(b.id),
    'loyalty', case when b.loyalty_visits is not null then jsonb_build_object('visits', b.loyalty_visits, 'reward', b.loyalty_reward) end,
    'packages', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'service_id', k.service_id, 'sessions', k.sessions,
        'price_cents', k.price_cents, 'valid_days', k.valid_days) order by k.price_cents)
      from public.packages k join public.services s on s.id = k.service_id and s.active
      where k.business_id = b.id and k.active), '[]'::jsonb),
    'club', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'price_cents', k.price_cents, 'sessions_per_month', k.sessions_per_month,
        'services', (select coalesce(jsonb_agg(s.name order by s.sort_order, s.name), '[]'::jsonb) from public.services s where s.id = any(k.service_ids) and s.active))
        order by k.price_cents)
      from public.club_plans k where k.business_id = b.id and k.active), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description,
        'duration_minutes', s.duration_minutes, 'price_cents', s.price_cents) order by s.sort_order, s.name)
      from public.services s where s.business_id = b.id and s.active), '[]'::jsonb),
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'bio', p.bio, 'avatar_url', p.avatar_url,
        'service_ids', (select coalesce(jsonb_agg(ps.service_id), '[]'::jsonb) from public.professional_services ps where ps.professional_id = p.id))
        order by p.sort_order, p.name)
      from public.professionals p where p.business_id = b.id and p.active), '[]'::jsonb)
  )
  from public.businesses b where b.slug = lower(p_slug)
$$;


revoke execute on function public.club_period(uuid, date) from public, anon;
grant execute on function public.club_period(uuid, date) to authenticated, service_role;
grant execute on function public.record_club_payment(uuid) to authenticated;
grant execute on function public.subscribe_club(uuid, uuid, boolean) to authenticated;
grant execute on function public.use_club_session(uuid, uuid) to authenticated;
grant execute on function public.get_public_business(text) to anon, authenticated;
