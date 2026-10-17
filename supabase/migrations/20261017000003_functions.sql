-- Só Marcar: regras de negócio no banco (criação de negócio, disponibilidade e reservas públicas)

-- Perfil criado automaticamente no cadastro (e-mail, Google, Facebook ou Apple)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Normaliza telefone brasileiro para E.164 sem "+": 11999998888 -> 5511999998888
create or replace function public.normalize_phone(p text) returns text
language sql immutable as $$
  select case
    when d is null or d = '' then null
    when length(d) in (10, 11) then '55' || d
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

-- Preenche fim do atendimento e fim do bloqueio a partir do serviço
create or replace function public.appointments_fill_times() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dur int; v_buf int;
begin
  if new.ends_at is null or new.blocked_until is null
     or (tg_op = 'UPDATE' and (new.starts_at <> old.starts_at or new.service_id <> old.service_id)) then
    select duration_minutes, buffer_minutes into v_dur, v_buf
    from public.services where id = new.service_id and business_id = new.business_id;
    if v_dur is null then raise exception 'Serviço inválido' using errcode = '22023'; end if;
    new.ends_at := new.starts_at + make_interval(mins => v_dur);
    new.blocked_until := new.ends_at + make_interval(mins => v_buf);
  end if;
  return new;
end $$;

create trigger appointments_fill_times before insert or update on public.appointments
  for each row execute function public.appointments_fill_times();

-- O negócio pode operar? (teste grátis válido, assinatura ativa ou em atraso com carência)
create or replace function public.business_is_active(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.business_id = p_business
      and (
        (s.status = 'trialing' and s.trial_ends_at > now())
        or s.status = 'active'
        or (s.status = 'past_due' and coalesce(s.current_period_end, now()) > now() - interval '5 days')
        or (s.status = 'canceled' and s.current_period_end > now())
      )
  )
$$;

-- Cria o negócio do usuário logado: vira owner, ganha 30 dias grátis e um profissional (ele mesmo)
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

  insert into public.subscriptions (business_id, status, trial_ends_at)
  values (v_id, 'trialing', now() + interval '30 days');

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

-- Horários livres de um dia (data local do negócio)
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
        and tstzrange(a.starts_at, a.blocked_until, '[)') && tstzrange(c.st, c.blk, '[)')
    )
    and not exists (
      select 1 from public.time_off t
      where t.professional_id = c.pro_id
        and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(c.st, c.blk, '[)')
    )
  order by c.st, c.name
$$;

-- Dados públicos da página de agendamento (sem nada privado)
create or replace function public.get_public_business(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'slug', b.slug, 'segment', b.segment, 'description', b.description,
    'timezone', b.timezone, 'whatsapp', b.whatsapp, 'phone', b.phone, 'address', b.address,
    'theme', b.theme, 'cancellation_policy', b.cancellation_policy,
    'max_days_ahead', b.max_days_ahead, 'cancel_notice_minutes', b.cancel_notice_minutes,
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

-- Reserva pública (sem conta). Revalida tudo no servidor; o EXCLUDE impede corrida.
create or replace function public.create_public_booking(
  p_slug text, p_service uuid, p_professional uuid, p_starts_at timestamptz,
  p_name text, p_phone text, p_email text default null, p_idempotency_key text default null,
  p_marketing_consent boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.businesses%rowtype;
  v_phone text := public.normalize_phone(p_phone);
  v_customer uuid; v_appt public.appointments%rowtype; v_price int; v_local date;
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
      return jsonb_build_object('id', v_appt.id, 'manage_token', v_appt.manage_token, 'starts_at', v_appt.starts_at);
    end if;
  end if;

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

  begin
    insert into public.appointments (business_id, professional_id, service_id, customer_id, starts_at, status, source, price_cents, idempotency_key)
    values (b.id, p_professional, p_service, v_customer, p_starts_at, 'confirmed', 'public', v_price, p_idempotency_key)
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'Esse horário acabou de ser reservado por outra pessoa' using errcode = '23P01';
  end;

  insert into public.notification_jobs (business_id, appointment_id, channel, kind, scheduled_for)
  values
    (b.id, v_appt.id, 'email', 'confirmation', now()),
    (b.id, v_appt.id, 'email', 'reminder', greatest(now(), v_appt.starts_at - interval '24 hours'));

  insert into public.audit_logs (business_id, action, entity, entity_id, data)
  values (b.id, 'appointment.created', 'appointment', v_appt.id, jsonb_build_object('source', 'public'));

  return jsonb_build_object('id', v_appt.id, 'manage_token', v_appt.manage_token, 'starts_at', v_appt.starts_at);
end $$;

-- Consulta da reserva pelo link do cliente
create or replace function public.get_booking_by_token(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'status', a.status, 'starts_at', a.starts_at, 'ends_at', a.ends_at,
    'service', jsonb_build_object('id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes, 'price_cents', a.price_cents),
    'professional', jsonb_build_object('id', p.id, 'name', p.name),
    'customer_name', c.name,
    'business', jsonb_build_object('name', b.name, 'slug', b.slug, 'timezone', b.timezone, 'theme', b.theme,
      'whatsapp', b.whatsapp, 'cancel_notice_minutes', b.cancel_notice_minutes, 'cancellation_policy', b.cancellation_policy),
    'can_change', a.status in ('pending','confirmed') and a.starts_at - make_interval(mins => b.cancel_notice_minutes) > now()
  )
  from public.appointments a
  join public.services s on s.id = a.service_id
  join public.professionals p on p.id = a.professional_id
  join public.customers c on c.id = a.customer_id
  join public.businesses b on b.id = a.business_id
  where a.manage_token = p_token
$$;

create or replace function public.cancel_booking_by_token(p_token uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.appointments%rowtype; v_notice int;
begin
  select * into a from public.appointments where manage_token = p_token for update;
  if not found then raise exception 'Reserva não encontrada' using errcode = 'P0002'; end if;
  if a.status not in ('pending','confirmed') then raise exception 'Essa reserva não pode mais ser alterada' using errcode = '22023'; end if;
  select cancel_notice_minutes into v_notice from public.businesses where id = a.business_id;
  if a.starts_at - make_interval(mins => v_notice) <= now() then
    raise exception 'O prazo para cancelar pelo link acabou. Fale com o estabelecimento.' using errcode = '22023';
  end if;
  update public.appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = left(p_reason, 300) where id = a.id;
  update public.notification_jobs set status = 'skipped' where appointment_id = a.id and status = 'pending' and kind = 'reminder';
  insert into public.audit_logs (business_id, action, entity, entity_id) values (a.business_id, 'appointment.cancelled_by_customer', 'appointment', a.id);
end $$;

-- Remarcação pelo cliente: cancela a antiga e cria a nova na mesma transação
create or replace function public.reschedule_booking_by_token(
  p_token uuid, p_starts_at timestamptz, p_professional uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; v_pro uuid; v_new public.appointments%rowtype;
begin
  select * into a from public.appointments where manage_token = p_token for update;
  if not found then raise exception 'Reserva não encontrada' using errcode = 'P0002'; end if;
  select * into b from public.businesses where id = a.business_id;
  if a.status not in ('pending','confirmed') or a.starts_at - make_interval(mins => b.cancel_notice_minutes) <= now() then
    raise exception 'Essa reserva não pode mais ser remarcada pelo link' using errcode = '22023';
  end if;
  v_pro := coalesce(p_professional, a.professional_id);

  update public.appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = 'remarcado' where id = a.id;

  if not exists (
    select 1 from public.get_available_slots(b.slug, a.service_id, (p_starts_at at time zone b.timezone)::date, v_pro) x
    where x.professional_id = v_pro and x.starts_at = p_starts_at
  ) then
    raise exception 'Esse horário não está disponível' using errcode = '23P01';
  end if;

  begin
    insert into public.appointments (business_id, professional_id, service_id, customer_id, starts_at, status, source, price_cents, rescheduled_from)
    values (a.business_id, v_pro, a.service_id, a.customer_id, p_starts_at, 'confirmed', 'public', a.price_cents, a.id)
    returning * into v_new;
  exception when exclusion_violation then
    raise exception 'Esse horário acabou de ser reservado por outra pessoa' using errcode = '23P01';
  end;

  update public.notification_jobs set status = 'skipped' where appointment_id = a.id and status = 'pending';
  insert into public.notification_jobs (business_id, appointment_id, channel, kind, scheduled_for)
  values (a.business_id, v_new.id, 'email', 'reschedule', now()),
         (a.business_id, v_new.id, 'email', 'reminder', greatest(now(), v_new.starts_at - interval '24 hours'));
  insert into public.audit_logs (business_id, action, entity, entity_id, data)
  values (a.business_id, 'appointment.rescheduled_by_customer', 'appointment', v_new.id, jsonb_build_object('from', a.id));
  return jsonb_build_object('id', v_new.id, 'manage_token', v_new.manage_token, 'starts_at', v_new.starts_at);
end $$;

-- Permissões das funções
revoke execute on all functions in schema public from public;
grant execute on function public.get_available_slots(text, uuid, date, uuid) to anon, authenticated;
grant execute on function public.get_public_business(text) to anon, authenticated;
grant execute on function public.create_public_booking(text, uuid, uuid, timestamptz, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.get_booking_by_token(uuid) to anon, authenticated;
grant execute on function public.cancel_booking_by_token(uuid, text) to anon, authenticated;
grant execute on function public.reschedule_booking_by_token(uuid, timestamptz, uuid) to anon, authenticated;
grant execute on function public.create_business(text, text, text, text) to authenticated;
grant execute on function public.is_member(uuid), public.has_role(uuid, text[]), public.business_is_active(uuid),
  public.normalize_phone(text) to authenticated;
grant execute on all functions in schema public to service_role;
