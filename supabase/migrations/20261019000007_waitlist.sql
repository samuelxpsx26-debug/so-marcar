-- Lista de espera: quando o dia que o cliente quer está lotado, ele entra na fila
-- e o dono é avisado em "Oportunidades de Hoje" assim que abrir vaga.

create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  service_id uuid not null references public.services(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete set null,
  desired_date date not null,
  period text not null default 'qualquer' check (period in ('qualquer','manha','tarde','noite')),
  note text check (char_length(note) <= 300),
  status text not null default 'waiting' check (status in ('waiting','notified','booked','removed')),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  foreign key (business_id, customer_id) references public.customers(business_id, id) on delete cascade
);
create index if not exists waitlist_business_date on public.waitlist_entries (business_id, desired_date) where status in ('waiting','notified');
-- Um pedido ativo por cliente, serviço e dia
create unique index if not exists waitlist_one_active on public.waitlist_entries (business_id, customer_id, service_id, desired_date)
  where status in ('waiting','notified');

alter table public.waitlist_entries enable row level security;
drop policy if exists waitlist_member_all on public.waitlist_entries;
create policy waitlist_member_all on public.waitlist_entries for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));

-- Entrada pública na fila (sem login), com as mesmas proteções da reserva
create or replace function public.join_waitlist(
  p_slug text, p_service uuid, p_date date, p_name text, p_phone text,
  p_period text default 'qualquer', p_professional uuid default null, p_note text default null,
  p_marketing_consent boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.businesses%rowtype;
  v_phone text := public.normalize_phone(p_phone);
  v_today date; v_customer uuid; v_id uuid; v_pos int;
begin
  select * into b from public.businesses where slug = lower(p_slug);
  if not found or not public.business_is_active(b.id) then
    raise exception 'Agenda indisponível no momento' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.services where id = p_service and business_id = b.id and active) then
    raise exception 'Serviço indisponível' using errcode = '22023';
  end if;
  if p_professional is not null and not exists (select 1 from public.professionals where id = p_professional and business_id = b.id and active) then
    raise exception 'Profissional indisponível' using errcode = '22023';
  end if;
  v_today := (now() at time zone b.timezone)::date;
  if p_date is null or p_date < v_today or p_date > v_today + b.max_days_ahead then
    raise exception 'Escolha uma data dentro da agenda aberta' using errcode = '22023';
  end if;
  -- Dia sem expediente (folga) não tem fila: não vai abrir vaga
  if not exists (
    select 1 from public.working_hours wh join public.professionals pr on pr.id = wh.professional_id and pr.active
    where wh.business_id = b.id and wh.weekday = extract(dow from p_date)
      and (p_professional is null or wh.professional_id = p_professional)
  ) then
    raise exception 'Não há atendimento nesse dia. Escolha outra data.' using errcode = '22023';
  end if;
  if coalesce(p_period, 'qualquer') not in ('qualquer','manha','tarde','noite') then
    raise exception 'Período inválido' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Informe seu nome' using errcode = '22023'; end if;
  if v_phone is null or v_phone !~ '^[0-9]{12,15}$' then raise exception 'WhatsApp inválido' using errcode = '22023'; end if;

  -- Proteção contra abuso: no máximo 3 pedidos ativos por telefone neste negócio
  if (select count(*) from public.waitlist_entries w join public.customers c on c.id = w.customer_id
      where w.business_id = b.id and c.phone = v_phone and w.status in ('waiting','notified') and w.desired_date >= v_today) >= 3 then
    raise exception 'Você já está na lista de espera de outros dias. Fale com o estabelecimento.' using errcode = '54000';
  end if;

  insert into public.customers (business_id, name, phone, marketing_consent)
  values (b.id, left(trim(p_name), 120), v_phone, coalesce(p_marketing_consent, false))
  on conflict (business_id, phone) do update
    set marketing_consent = public.customers.marketing_consent or excluded.marketing_consent
  returning id into v_customer;

  select id into v_id from public.waitlist_entries
  where business_id = b.id and customer_id = v_customer and service_id = p_service and desired_date = p_date and status in ('waiting','notified');
  if v_id is null then
    insert into public.waitlist_entries (business_id, customer_id, service_id, professional_id, desired_date, period, note)
    values (b.id, v_customer, p_service, p_professional, p_date, coalesce(p_period, 'qualquer'), nullif(left(trim(coalesce(p_note, '')), 300), ''))
    returning id into v_id;
    insert into public.audit_logs (business_id, action, entity, entity_id) values (b.id, 'waitlist.joined', 'waitlist_entry', v_id);
  end if;

  select count(*) into v_pos from public.waitlist_entries w
  where w.business_id = b.id and w.desired_date = p_date and w.status = 'waiting'
    and w.created_at <= (select created_at from public.waitlist_entries where id = v_id);

  return jsonb_build_object('id', v_id, 'position', greatest(v_pos, 1));
end $$;

-- Quando o cliente marca para aquele dia, o pedido de espera sai da fila sozinho
create or replace function public.waitlist_mark_booked() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('pending','confirmed') then
    update public.waitlist_entries w set status = 'booked'
    from public.businesses b
    where b.id = new.business_id and w.business_id = new.business_id and w.customer_id = new.customer_id
      and w.desired_date = (new.starts_at at time zone b.timezone)::date and w.status in ('waiting','notified');
  end if;
  return new;
end $$;

drop trigger if exists appointments_waitlist_booked on public.appointments;
create trigger appointments_waitlist_booked after insert on public.appointments
  for each row execute function public.waitlist_mark_booked();

grant execute on function public.join_waitlist(text, uuid, date, text, text, text, uuid, text, boolean) to anon, authenticated;
grant all on public.waitlist_entries to authenticated, service_role;
