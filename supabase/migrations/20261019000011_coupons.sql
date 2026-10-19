-- Cupons de desconto: o dono cria códigos (ex.: VOLTA10) e o cliente usa na página de agendamento.
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  kind text not null check (kind in ('percent', 'fixed')),
  value int not null check (value > 0),
  expires_on date,
  max_uses int check (max_uses is null or max_uses > 0),
  once_per_customer boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  unique (business_id, code),
  unique (business_id, id)
);

alter table public.coupons enable row level security;
drop policy if exists coupons_member_all on public.coupons;
create policy coupons_member_all on public.coupons for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));

alter table public.appointments add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
alter table public.appointments add column if not exists discount_cents int not null default 0 check (discount_cents >= 0);
create index if not exists appointments_coupon on public.appointments (coupon_id) where coupon_id is not null;

-- Acha o cupom válido para este cliente, ou explica em português por que não vale
create or replace function public.find_coupon(p_business uuid, p_code text, p_customer uuid default null)
returns public.coupons
language plpgsql stable security definer set search_path = public as $$
declare k public.coupons%rowtype; v_tz text;
begin
  select * into k from public.coupons where business_id = p_business and code = upper(trim(p_code));
  if not found or not k.active then raise exception 'Cupom não encontrado' using errcode = '22023'; end if;
  select timezone into v_tz from public.businesses where id = p_business;
  if k.expires_on is not null and k.expires_on < (now() at time zone v_tz)::date then
    raise exception 'Esse cupom venceu' using errcode = '22023';
  end if;
  if k.max_uses is not null and (select count(*) from public.appointments a where a.coupon_id = k.id and a.status <> 'cancelled') >= k.max_uses then
    raise exception 'Esse cupom já foi todo usado' using errcode = '22023';
  end if;
  if k.once_per_customer and p_customer is not null and exists (
    select 1 from public.appointments a where a.coupon_id = k.id and a.customer_id = p_customer and a.status <> 'cancelled'
  ) then
    raise exception 'Você já usou esse cupom' using errcode = '22023';
  end if;
  return k;
end $$;

create or replace function public.coupon_discount(k public.coupons, p_price int) returns int
language sql immutable as $$
  select case when k.id is null then 0
    when k.kind = 'percent' then least(p_price, round(p_price * k.value / 100.0)::int)
    else least(p_price, k.value) end
$$;

-- Prévia na página de agendamento: quanto o cupom desconta neste serviço
create or replace function public.check_coupon(p_slug text, p_code text, p_service uuid, p_phone text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b public.businesses%rowtype; k public.coupons%rowtype; v_price int; v_customer uuid;
begin
  select * into b from public.businesses where slug = lower(p_slug);
  if not found then raise exception 'Agenda indisponível no momento' using errcode = 'P0002'; end if;
  select price_cents into v_price from public.services where id = p_service and business_id = b.id;
  if v_price is null then raise exception 'Serviço inválido' using errcode = '22023'; end if;
  if p_phone is not null then
    select id into v_customer from public.customers where business_id = b.id and phone = public.normalize_phone(p_phone);
  end if;
  k := public.find_coupon(b.id, p_code, v_customer);
  return jsonb_build_object('code', k.code, 'kind', k.kind, 'value', k.value, 'discount_cents', public.coupon_discount(k, v_price));
end $$;

drop function if exists public.create_public_booking(text, uuid, uuid, timestamptz, text, text, text, text, boolean);

-- Reserva pública: agora aceita cupom (o desconto sai do preço, e o sinal é calculado sobre o preço com desconto)
create or replace function public.create_public_booking(
  p_slug text, p_service uuid, p_professional uuid, p_starts_at timestamptz,
  p_name text, p_phone text, p_email text default null, p_idempotency_key text default null,
  p_marketing_consent boolean default false, p_coupon text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.businesses%rowtype;
  v_phone text := public.normalize_phone(p_phone);
  v_customer uuid; v_appt public.appointments%rowtype; v_price int; v_local date; v_deposit int := 0;
  v_coupon public.coupons%rowtype; v_discount int := 0;
begin
  select * into b from public.businesses where slug = lower(p_slug);
  if not found or not public.business_is_active(b.id) then
    raise exception 'Agenda indisponível no momento' using errcode = 'P0002';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Informe seu nome' using errcode = '22023'; end if;
  if v_phone is null or v_phone !~ '^[0-9]{12,15}$' then raise exception 'WhatsApp inválido' using errcode = '22023'; end if;
  if p_email is not null and p_email <> '' and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido' using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select * into v_appt from public.appointments where business_id = b.id and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('id', v_appt.id, 'manage_token', v_appt.manage_token, 'starts_at', v_appt.starts_at,
        'deposit_cents', v_appt.deposit_cents, 'deposit_status', v_appt.deposit_status, 'deposit_due_at', v_appt.deposit_due_at);
    end if;
  end if;

  perform public.expire_unpaid_deposits(b.id);

  v_local := (p_starts_at at time zone b.timezone)::date;
  if not exists (
    select 1 from public.get_available_slots(b.slug, p_service, v_local, p_professional) x
    where x.professional_id = p_professional and x.starts_at = p_starts_at
  ) then
    raise exception 'Esse horário não está mais disponível' using errcode = '23P01';
  end if;

  -- Proteção contra abuso: no máximo 3 reservas futuras ativas por telefone neste negócio
  if (select count(*) from public.appointments a join public.customers c on c.id = a.customer_id
      where a.business_id = b.id and c.phone = v_phone and a.status in ('pending','confirmed') and a.starts_at > now()) >= 3 then
    raise exception 'Você já tem reservas demais em aberto. Fale com o estabelecimento.' using errcode = '54000';
  end if;

  insert into public.customers (business_id, name, phone, email, marketing_consent)
  values (b.id, left(trim(p_name), 120), v_phone, nullif(trim(p_email), ''), coalesce(p_marketing_consent, false))
  on conflict (business_id, phone) do update
    set email = coalesce(excluded.email, public.customers.email),
        marketing_consent = public.customers.marketing_consent or excluded.marketing_consent
  returning id into v_customer;

  select price_cents into v_price from public.services where id = p_service;
  if nullif(trim(p_coupon), '') is not null then
    v_coupon := public.find_coupon(b.id, p_coupon, v_customer);
    v_discount := public.coupon_discount(v_coupon, v_price);
    v_price := v_price - v_discount;
  end if;
  if b.deposit_mode = 'percent' then v_deposit := least(v_price, round(v_price * b.deposit_value / 100.0)::int);
  elsif b.deposit_mode = 'fixed' then v_deposit := least(v_price, b.deposit_value);
  end if;

  begin
    insert into public.appointments (business_id, professional_id, service_id, customer_id, starts_at, status, source, price_cents, idempotency_key,
      deposit_cents, deposit_status, deposit_due_at, coupon_id, discount_cents)
    values (b.id, p_professional, p_service, v_customer, p_starts_at,
      case when v_deposit > 0 then 'pending' else 'confirmed' end, 'public', v_price, p_idempotency_key,
      v_deposit, case when v_deposit > 0 then 'awaiting' else 'none' end,
      case when v_deposit > 0 then least(now() + make_interval(mins => b.deposit_hold_minutes), p_starts_at) end,
      v_coupon.id, v_discount)
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'Esse horário acabou de ser reservado por outra pessoa' using errcode = '23P01';
  end;

  -- Com sinal, a confirmação por e-mail só sai quando o dono confirmar o Pix
  insert into public.notification_jobs (business_id, appointment_id, channel, kind, scheduled_for)
  select b.id, v_appt.id, 'email', 'confirmation', now() where v_deposit = 0
  union all
  select b.id, v_appt.id, 'email', 'reminder', greatest(now(), v_appt.starts_at - interval '24 hours');

  insert into public.audit_logs (business_id, action, entity, entity_id, data)
  values (b.id, 'appointment.created', 'appointment', v_appt.id, jsonb_build_object('source', 'public', 'deposit_cents', v_deposit, 'coupon', v_coupon.code, 'discount_cents', v_discount));

  return jsonb_build_object('id', v_appt.id, 'manage_token', v_appt.manage_token, 'starts_at', v_appt.starts_at,
    'deposit_cents', v_appt.deposit_cents, 'deposit_status', v_appt.deposit_status, 'deposit_due_at', v_appt.deposit_due_at);
end $$;


grant select, insert, update, delete on public.coupons to authenticated;
grant all on public.coupons to service_role;
revoke execute on function public.find_coupon(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.check_coupon(text, text, uuid, text) to anon, authenticated;
grant execute on function public.create_public_booking(text, uuid, uuid, timestamptz, text, text, text, text, boolean, text) to anon, authenticated;
