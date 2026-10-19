-- Sinal por Pix: o cliente paga um sinal na chave Pix do próprio estabelecimento
-- para garantir o horário. Sem intermediação: o dono confirma quando o dinheiro cai.

alter table public.businesses
  add column if not exists deposit_mode text not null default 'off' check (deposit_mode in ('off','percent','fixed')),
  -- percent: 1 a 100 (%); fixed: centavos
  add column if not exists deposit_value integer not null default 0 check (deposit_value >= 0),
  -- Tempo que o horário fica reservado esperando o Pix
  add column if not exists deposit_hold_minutes integer not null default 60 check (deposit_hold_minutes between 10 and 1440),
  add column if not exists pix_key_type text check (pix_key_type in ('cpf','cnpj','telefone','email','aleatoria')),
  add column if not exists pix_key text check (char_length(pix_key) <= 77),
  add column if not exists pix_holder text check (char_length(pix_holder) <= 60),
  add column if not exists pix_city text check (char_length(pix_city) <= 40);

alter table public.businesses drop constraint if exists businesses_deposit_ready;
alter table public.businesses add constraint businesses_deposit_ready check (
  deposit_mode = 'off'
  or (pix_key is not null and pix_holder is not null and pix_city is not null
      and ((deposit_mode = 'percent' and deposit_value between 1 and 100) or (deposit_mode = 'fixed' and deposit_value between 100 and 10000000)))
);

alter table public.appointments
  add column if not exists deposit_cents integer not null default 0 check (deposit_cents >= 0),
  add column if not exists deposit_status text not null default 'none' check (deposit_status in ('none','awaiting','paid','waived')),
  add column if not exists deposit_due_at timestamptz,
  add column if not exists deposit_paid_at timestamptz;
create index if not exists appointments_deposit_awaiting on public.appointments (deposit_due_at) where deposit_status = 'awaiting' and status = 'pending';

-- Libera os horários cujo Pix não chegou no prazo
create or replace function public.expire_unpaid_deposits(p_business uuid default null) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with x as (
    update public.appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = 'sinal não pago no prazo'
    where status = 'pending' and deposit_status = 'awaiting' and deposit_due_at < now()
      and (p_business is null or business_id = p_business)
    returning id, business_id
  ), j as (
    update public.notification_jobs nj set status = 'skipped' from x where nj.appointment_id = x.id and nj.status = 'pending'
  ), l as (
    insert into public.audit_logs (business_id, action, entity, entity_id) select business_id, 'appointment.deposit_expired', 'appointment', id from x
  )
  select count(*) into n from x;
  return n;
end $$;

-- Horários livres: reserva com sinal vencido não ocupa mais o horário
create or replace function public.get_available_slots(
  p_slug text, p_service uuid, p_date date, p_professional uuid default null
) returns table (professional_id uuid, professional_name text, starts_at timestamptz)
language sql stable security definer set search_path = public as $$
  with b as (
    select * from public.businesses where slug = lower(p_slug) and public.business_is_active(id)
  ),
  s as (
    select sv.* from public.services sv join b on b.id = sv.business_id
    where sv.id = p_service and sv.active
  ),
  pros as (
    select p.* from public.professionals p join b on b.id = p.business_id
    where p.active
      and (p_professional is null or p.id = p_professional)
      and (
        exists (select 1 from public.professional_services ps where ps.professional_id = p.id and ps.service_id = p_service)
        or not exists (select 1 from public.professional_services ps where ps.professional_id = p.id)
      )
  ),
  ranges as (
    select pr.id as pro_id, pr.name,
      ((p_date + wh.start_time)::timestamp at time zone b.timezone) as rs,
      ((p_date + wh.end_time)::timestamp at time zone b.timezone) as re
    from pros pr
    join public.working_hours wh on wh.professional_id = pr.id
    cross join b
    where wh.weekday = extract(dow from p_date)::int
  ),
  cand as (
    select r.pro_id, r.name, g as st,
      g + make_interval(mins => s.duration_minutes + s.buffer_minutes) as blk
    from ranges r cross join s cross join b,
      generate_series(r.rs, r.re - make_interval(mins => s.duration_minutes + s.buffer_minutes),
                      make_interval(mins => b.slot_step_minutes)) g
  )
  select c.pro_id, c.name, c.st
  from cand c cross join b
  where c.st >= now() + make_interval(mins => b.min_notice_minutes)
    and c.st <= now() + make_interval(days => b.max_days_ahead)
    and not exists (
      select 1 from public.appointments a
      where a.professional_id = c.pro_id and a.status in ('pending','confirmed')
        and not (a.status = 'pending' and a.deposit_status = 'awaiting' and a.deposit_due_at < now())
        and tstzrange(a.starts_at, a.blocked_until, '[)') && tstzrange(c.st, c.blk, '[)')
    )
    and not exists (
      select 1 from public.time_off t
      where t.professional_id = c.pro_id
        and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(c.st, c.blk, '[)')
    )
  order by c.st, c.name
$$;

-- Página pública: mostra a regra do sinal (a chave Pix só aparece depois de reservar)
create or replace function public.get_public_business(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'slug', b.slug, 'segment', b.segment, 'description', b.description,
    'timezone', b.timezone, 'whatsapp', b.whatsapp, 'phone', b.phone, 'address', b.address,
    'theme', b.theme, 'cancellation_policy', b.cancellation_policy,
    'max_days_ahead', b.max_days_ahead, 'cancel_notice_minutes', b.cancel_notice_minutes,
    'deposit', jsonb_build_object('mode', b.deposit_mode, 'value', b.deposit_value, 'hold_minutes', b.deposit_hold_minutes),
    'active', public.business_is_active(b.id),
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

-- Reserva pública: com sinal ligado, nasce "pendente" esperando o Pix
create or replace function public.create_public_booking(
  p_slug text, p_service uuid, p_professional uuid, p_starts_at timestamptz,
  p_name text, p_phone text, p_email text default null, p_idempotency_key text default null,
  p_marketing_consent boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.businesses%rowtype;
  v_phone text := public.normalize_phone(p_phone);
  v_customer uuid; v_appt public.appointments%rowtype; v_price int; v_local date; v_deposit int := 0;
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
  if b.deposit_mode = 'percent' then v_deposit := least(v_price, round(v_price * b.deposit_value / 100.0)::int);
  elsif b.deposit_mode = 'fixed' then v_deposit := least(v_price, b.deposit_value);
  end if;

  begin
    insert into public.appointments (business_id, professional_id, service_id, customer_id, starts_at, status, source, price_cents, idempotency_key,
      deposit_cents, deposit_status, deposit_due_at)
    values (b.id, p_professional, p_service, v_customer, p_starts_at,
      case when v_deposit > 0 then 'pending' else 'confirmed' end, 'public', v_price, p_idempotency_key,
      v_deposit, case when v_deposit > 0 then 'awaiting' else 'none' end,
      case when v_deposit > 0 then least(now() + make_interval(mins => b.deposit_hold_minutes), p_starts_at) end)
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
  values (b.id, 'appointment.created', 'appointment', v_appt.id, jsonb_build_object('source', 'public', 'deposit_cents', v_deposit));

  return jsonb_build_object('id', v_appt.id, 'manage_token', v_appt.manage_token, 'starts_at', v_appt.starts_at,
    'deposit_cents', v_appt.deposit_cents, 'deposit_status', v_appt.deposit_status, 'deposit_due_at', v_appt.deposit_due_at);
end $$;

-- Link do cliente: inclui o sinal e, enquanto espera o Pix, os dados para pagar
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

-- Remarcação: o sinal (pago ou pendente) acompanha a nova reserva
create or replace function public.reschedule_booking_by_token(
  p_token uuid, p_starts_at timestamptz, p_professional uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; v_pro uuid; v_new public.appointments%rowtype;
begin
  select * into a from public.appointments where manage_token = p_token for update;
  if not found then raise exception 'Reserva não encontrada' using errcode = 'P0002'; end if;
  select * into b from public.businesses where id = a.business_id;
  if a.status not in ('pending','confirmed') or a.starts_at - make_interval(mins => b.cancel_notice_minutes) <= now()
     or (a.status = 'pending' and a.deposit_status = 'awaiting' and a.deposit_due_at < now()) then
    raise exception 'Essa reserva não pode mais ser remarcada pelo link' using errcode = '22023';
  end if;
  v_pro := coalesce(p_professional, a.professional_id);

  update public.appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = 'remarcado' where id = a.id;
  perform public.expire_unpaid_deposits(a.business_id);

  if not exists (
    select 1 from public.get_available_slots(b.slug, a.service_id, (p_starts_at at time zone b.timezone)::date, v_pro) x
    where x.professional_id = v_pro and x.starts_at = p_starts_at
  ) then
    raise exception 'Esse horário não está disponível' using errcode = '23P01';
  end if;

  begin
    insert into public.appointments (business_id, professional_id, service_id, customer_id, starts_at, status, source, price_cents, rescheduled_from,
      deposit_cents, deposit_status, deposit_due_at, deposit_paid_at)
    values (a.business_id, v_pro, a.service_id, a.customer_id, p_starts_at, a.status, 'public', a.price_cents, a.id,
      a.deposit_cents, a.deposit_status, case when a.deposit_status = 'awaiting' then least(a.deposit_due_at, p_starts_at) else a.deposit_due_at end, a.deposit_paid_at)
    returning * into v_new;
  exception when exclusion_violation then
    raise exception 'Esse horário acabou de ser reservado por outra pessoa' using errcode = '23P01';
  end;

  update public.notification_jobs set status = 'skipped' where appointment_id = a.id and status = 'pending';
  insert into public.notification_jobs (business_id, appointment_id, channel, kind, scheduled_for)
  select a.business_id, v_new.id, 'email', 'reschedule', now() where v_new.status = 'confirmed'
  union all
  select a.business_id, v_new.id, 'email', 'reminder', greatest(now(), v_new.starts_at - interval '24 hours');
  insert into public.audit_logs (business_id, action, entity, entity_id, data)
  values (a.business_id, 'appointment.rescheduled_by_customer', 'appointment', v_new.id, jsonb_build_object('from', a.id));
  return jsonb_build_object('id', v_new.id, 'manage_token', v_new.manage_token, 'starts_at', v_new.starts_at);
end $$;

-- Dono confirma que o Pix caiu (ou dispensa o sinal): a reserva vira confirmada
create or replace function public.confirm_deposit(p_appointment uuid, p_waive boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare a public.appointments%rowtype;
begin
  select * into a from public.appointments where id = p_appointment for update;
  if not found or not public.is_member(a.business_id) then raise exception 'Reserva não encontrada' using errcode = 'P0002'; end if;
  if a.deposit_status not in ('awaiting') or a.status not in ('pending','cancelled') then
    raise exception 'Essa reserva não está esperando sinal' using errcode = '22023';
  end if;
  -- Pix que chegou depois do prazo: reativa se o horário ainda estiver livre
  if a.status = 'cancelled' then
    if a.cancel_reason is distinct from 'sinal não pago no prazo' then raise exception 'Essa reserva foi cancelada' using errcode = '22023'; end if;
    if a.starts_at <= now() then raise exception 'O horário já passou' using errcode = '22023'; end if;
  end if;
  begin
    update public.appointments set status = 'confirmed', cancelled_at = null, cancel_reason = null,
      deposit_status = case when p_waive then 'waived' else 'paid' end,
      deposit_paid_at = case when p_waive then null else now() end
    where id = a.id;
  exception when exclusion_violation then
    raise exception 'Esse horário já foi ocupado por outra reserva. Combine outro com o cliente.' using errcode = '23P01';
  end;
  insert into public.notification_jobs (business_id, appointment_id, channel, kind, scheduled_for)
  values (a.business_id, a.id, 'email', 'confirmation', now());
  if a.status = 'cancelled' then
    insert into public.notification_jobs (business_id, appointment_id, channel, kind, scheduled_for)
    values (a.business_id, a.id, 'email', 'reminder', greatest(now(), a.starts_at - interval '24 hours'));
  end if;
  insert into public.audit_logs (business_id, actor_id, action, entity, entity_id)
  values (a.business_id, auth.uid(), case when p_waive then 'appointment.deposit_waived' else 'appointment.deposit_paid' end, 'appointment', a.id);
end $$;

revoke execute on function public.expire_unpaid_deposits(uuid) from public, anon;
grant execute on function public.expire_unpaid_deposits(uuid) to authenticated, service_role;
grant execute on function public.confirm_deposit(uuid, boolean) to authenticated;
grant execute on function public.get_available_slots(text, uuid, date, uuid) to anon, authenticated;
grant execute on function public.get_public_business(text) to anon, authenticated;
grant execute on function public.create_public_booking(text, uuid, uuid, timestamptz, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.get_booking_by_token(uuid) to anon, authenticated;
grant execute on function public.reschedule_booking_by_token(uuid, timestamptz, uuid) to anon, authenticated;
