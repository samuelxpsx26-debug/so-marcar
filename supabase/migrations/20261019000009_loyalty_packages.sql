-- Cartão fidelidade e pacotes de sessões.
-- Fidelidade: cada atendimento realizado vale um selo; ao juntar N selos o cliente ganha o prêmio.
-- Pacotes: o dono vende "4 cortes por R$ 140" e desconta uma sessão a cada atendimento.

alter table public.businesses
  add column if not exists loyalty_visits integer check (loyalty_visits between 2 and 50),
  add column if not exists loyalty_reward text check (char_length(loyalty_reward) between 2 and 80);

create table if not exists public.loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  visits_used integer not null check (visits_used > 0),
  reward text check (char_length(reward) <= 80),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (business_id, customer_id) references public.customers(business_id, id) on delete cascade
);
create index if not exists loyalty_redemptions_customer on public.loyalty_redemptions (business_id, customer_id);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null,
  name text not null check (char_length(name) between 2 and 80),
  sessions integer not null check (sessions between 2 and 100),
  price_cents integer not null check (price_cents >= 0),
  valid_days integer check (valid_days between 1 and 730),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, service_id) references public.services(business_id, id) on delete cascade
);

create table if not exists public.customer_packages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  package_id uuid references public.packages(id) on delete set null,
  service_id uuid not null,
  name text not null check (char_length(name) between 2 and 80),
  sessions_total integer not null check (sessions_total between 1 and 100),
  sessions_used integer not null default 0 check (sessions_used >= 0),
  price_cents integer not null check (price_cents >= 0),
  expires_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (sessions_used <= sessions_total),
  unique (business_id, id),
  foreign key (business_id, customer_id) references public.customers(business_id, id) on delete cascade,
  foreign key (business_id, service_id) references public.services(business_id, id) on delete cascade
);
create index if not exists customer_packages_customer on public.customer_packages (business_id, customer_id);
create index if not exists customer_packages_created on public.customer_packages (business_id, created_at);

alter table public.appointments add column if not exists customer_package_id uuid references public.customer_packages(id) on delete set null;

drop trigger if exists set_updated_at on public.packages;
create trigger set_updated_at before update on public.packages for each row execute function public.set_updated_at();

alter table public.loyalty_redemptions enable row level security;
alter table public.packages enable row level security;
alter table public.customer_packages enable row level security;

drop policy if exists loyalty_member_all on public.loyalty_redemptions;
create policy loyalty_member_all on public.loyalty_redemptions for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));
drop policy if exists packages_member_select on public.packages;
create policy packages_member_select on public.packages for select to authenticated using (public.is_member(business_id));
drop policy if exists packages_admin_write on public.packages;
create policy packages_admin_write on public.packages for all to authenticated
  using (public.has_role(business_id, array['owner','admin'])) with check (public.has_role(business_id, array['owner','admin']));
drop policy if exists customer_packages_member_all on public.customer_packages;
create policy customer_packages_member_all on public.customer_packages for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));

grant select, insert, update, delete on public.loyalty_redemptions, public.packages, public.customer_packages to authenticated;
grant all on public.loyalty_redemptions, public.packages, public.customer_packages to service_role;

-- Selos atuais: atendimentos realizados menos os já trocados por prêmio
create or replace function public.loyalty_stamps(p_business uuid, p_customer uuid) returns integer
language sql stable security definer set search_path = public as $$
  select greatest(0,
    (select count(*) from public.appointments where business_id = p_business and customer_id = p_customer and status = 'completed')::int
    - coalesce((select sum(visits_used) from public.loyalty_redemptions where business_id = p_business and customer_id = p_customer), 0)::int)
$$;

-- Trocar selos pelo prêmio
create or replace function public.redeem_loyalty(p_customer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.customers%rowtype; b public.businesses%rowtype;
begin
  select * into c from public.customers where id = p_customer;
  if not found or not public.is_member(c.business_id) then raise exception 'Cliente não encontrado' using errcode = 'P0002'; end if;
  select * into b from public.businesses where id = c.business_id for update;
  if b.loyalty_visits is null then raise exception 'O cartão fidelidade está desligado' using errcode = '22023'; end if;
  if public.loyalty_stamps(b.id, c.id) < b.loyalty_visits then raise exception 'Ainda faltam selos para o prêmio' using errcode = '22023'; end if;
  insert into public.loyalty_redemptions (business_id, customer_id, visits_used, reward) values (b.id, c.id, b.loyalty_visits, b.loyalty_reward);
  insert into public.audit_logs (business_id, actor_id, action, entity, entity_id) values (b.id, auth.uid(), 'loyalty.redeemed', 'customer', c.id);
end $$;

-- Atendimento pago com uma sessão do pacote: marca como atendido, sem valor (o pacote já foi pago)
create or replace function public.use_package_session(p_appointment uuid, p_package uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.appointments%rowtype; k public.customer_packages%rowtype;
begin
  select * into a from public.appointments where id = p_appointment for update;
  if not found or not public.is_member(a.business_id) then raise exception 'Atendimento não encontrado' using errcode = 'P0002'; end if;
  if a.customer_package_id is not null then raise exception 'Esse atendimento já usou um pacote' using errcode = '22023'; end if;
  if a.status in ('cancelled','no_show') then raise exception 'Esse atendimento não pode usar o pacote' using errcode = '22023'; end if;
  select * into k from public.customer_packages where id = p_package and business_id = a.business_id for update;
  if not found or k.customer_id <> a.customer_id then raise exception 'Pacote não encontrado para esse cliente' using errcode = 'P0002'; end if;
  if k.service_id <> a.service_id then raise exception 'Esse pacote é de outro serviço' using errcode = '22023'; end if;
  if k.sessions_used >= k.sessions_total then raise exception 'O pacote não tem mais sessões' using errcode = '22023'; end if;
  if k.expires_at is not null and k.expires_at < a.starts_at then raise exception 'O pacote venceu' using errcode = '22023'; end if;
  update public.customer_packages set sessions_used = sessions_used + 1 where id = k.id;
  update public.appointments set status = 'completed', price_cents = 0, customer_package_id = k.id where id = a.id;
  insert into public.audit_logs (business_id, actor_id, action, entity, entity_id, data)
  values (a.business_id, auth.uid(), 'package.session_used', 'appointment', a.id, jsonb_build_object('package', k.id));
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

create or replace function public.get_booking_by_token(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'status', a.status, 'starts_at', a.starts_at, 'ends_at', a.ends_at,
    'service', jsonb_build_object('id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes, 'price_cents', a.price_cents),
    'professional', jsonb_build_object('id', p.id, 'name', p.name),
    'customer_name', c.name,
    'business', jsonb_build_object('name', b.name, 'slug', b.slug, 'timezone', b.timezone, 'theme', b.theme,
      'whatsapp', b.whatsapp, 'cancel_notice_minutes', b.cancel_notice_minutes, 'cancellation_policy', b.cancellation_policy),
    'deposit', jsonb_build_object('cents', a.deposit_cents, 'status',
        case when a.status = 'pending' and a.deposit_status = 'awaiting' and a.deposit_due_at < now() then 'expired' else a.deposit_status end,
      'due_at', a.deposit_due_at,
      'pix', case when a.status = 'pending' and a.deposit_status = 'awaiting' and a.deposit_due_at >= now() and b.pix_key is not null
        then jsonb_build_object('key', b.pix_key, 'type', b.pix_key_type, 'holder', b.pix_holder, 'city', b.pix_city) end),
    'loyalty', case when b.loyalty_visits is not null then jsonb_build_object('visits', b.loyalty_visits, 'reward', b.loyalty_reward,
      'stamps', public.loyalty_stamps(a.business_id, a.customer_id)) end,
    'can_change', a.status in ('pending','confirmed') and a.starts_at - make_interval(mins => b.cancel_notice_minutes) > now()
      and not (a.status = 'pending' and a.deposit_status = 'awaiting' and a.deposit_due_at < now())
  )
  from public.appointments a
  join public.services s on s.id = a.service_id
  join public.professionals p on p.id = a.professional_id
  join public.customers c on c.id = a.customer_id
  join public.businesses b on b.id = a.business_id
  where a.manage_token = p_token
$$;

revoke execute on function public.loyalty_stamps(uuid, uuid) from public, anon;
grant execute on function public.loyalty_stamps(uuid, uuid) to authenticated, service_role;
grant execute on function public.redeem_loyalty(uuid) to authenticated;
grant execute on function public.use_package_session(uuid, uuid) to authenticated;
grant execute on function public.get_public_business(text) to anon, authenticated;
grant execute on function public.get_booking_by_token(uuid) to anon, authenticated;
