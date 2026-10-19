-- Telefones digitados de jeitos diferentes viravam clientes diferentes:
-- "(011) 98888-7777" (zero antes do DDD) e "11 8888-7777" (celular sem o 9) agora caem no mesmo número.
create or replace function public.normalize_phone(p text) returns text
language sql immutable as $$
  select case
    when d = '' then null
    -- celular brasileiro sem o 9 na frente (todo celular tem 9 dígitos desde 2016)
    when length(d) = 12 and d like '55%' and substr(d, 5, 1) in ('6', '7', '8', '9') then substr(d, 1, 4) || '9' || substr(d, 5)
    else d
  end
  from (
    select case when length(x) in (10, 11) then '55' || x else x end as d
    from (select ltrim(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '0') as x) a
  ) b
$$;

begin;

-- Junta as fichas do mesmo cliente: fica a mais antiga, e atendimentos, pacotes, prêmios e lista de espera passam para ela
create temp table customer_merge as
with n as (
  select id, business_id, created_at, public.normalize_phone(phone) as np,
         row_number() over (partition by business_id, public.normalize_phone(phone) order by created_at, id) as rn
  from public.customers
)
select d.id as dup, k.id as keep, d.business_id
from n d join n k on k.business_id = d.business_id and k.np = d.np and k.rn = 1
where d.rn > 1;

update public.appointments a set customer_id = m.keep from customer_merge m where a.customer_id = m.dup;
do $$ begin
  if to_regclass('public.payments') is not null then
    update public.payments x set customer_id = m.keep from customer_merge m where x.customer_id = m.dup;
  end if;
end $$;
update public.loyalty_redemptions x set customer_id = m.keep from customer_merge m where x.customer_id = m.dup;
update public.customer_packages x set customer_id = m.keep from customer_merge m where x.customer_id = m.dup;
-- Pedido repetido na lista de espera (mesmo serviço e dia) fica um só
delete from public.waitlist_entries w using customer_merge m
where w.customer_id = m.dup and exists (
  select 1 from public.waitlist_entries k
  where k.customer_id = m.keep and k.service_id = w.service_id and k.desired_date = w.desired_date
);
update public.waitlist_entries x set customer_id = m.keep from customer_merge m where x.customer_id = m.dup;

-- A ficha que fica herda e-mail, observações e autorização de avisos das outras
update public.customers c set
  email = coalesce(c.email, (select d.email from public.customers d join customer_merge m on m.dup = d.id where m.keep = c.id and d.email is not null limit 1)),
  notes = coalesce(c.notes, (select d.notes from public.customers d join customer_merge m on m.dup = d.id where m.keep = c.id and d.notes is not null limit 1)),
  marketing_consent = c.marketing_consent or exists (select 1 from public.customers d join customer_merge m on m.dup = d.id where m.keep = c.id and d.marketing_consent)
where c.id in (select keep from customer_merge);

delete from public.customers c using customer_merge m where c.id = m.dup;
update public.customers set phone = public.normalize_phone(phone) where phone <> public.normalize_phone(phone);

drop table customer_merge;

commit;
