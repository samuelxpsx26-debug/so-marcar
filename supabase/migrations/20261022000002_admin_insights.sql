-- Painel do dono do Só Marcar (/admin): quem está usando o app, quem pagou e quem precisa de atenção.
-- 1) profiles.last_seen_at: o painel do lojista marca o último acesso (no máximo a cada 2 minutos).
-- 2) platform_accounts(): uma linha por negócio com dono, contato, uso e pagamentos. Só o servidor (service_role) chama.

alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.touch_last_seen() returns void
language sql volatile security definer set search_path = public as $$
  update profiles set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '2 minutes');
$$;
revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated, service_role;

-- Meses pagos = faturas pagas com valor (a fatura de R$ 0 do teste grátis não conta).
-- Eventos antigos sem amount_cents contam quando a assinatura já estava ativa.
create or replace function public.platform_accounts() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb) from (
    select
      b.id, b.name, b.slug, b.segment, b.created_at,
      o.full_name as owner_name,
      u.email as owner_email,
      coalesce(nullif(o.phone, ''), nullif(b.whatsapp, ''), nullif(b.phone, '')) as owner_phone,
      (select max(p.last_seen_at) from business_members m join profiles p on p.id = m.user_id where m.business_id = b.id) as last_seen_at,
      s.status, s.trial_ends_at, s.current_period_end, s.cancel_at_period_end, s.price_cents,
      (s.provider_customer_id is not null) as has_checkout,
      (select count(*) from subscription_events e where e.subscription_id = s.id and e.kind = 'invoice.paid'
         and coalesce((e.data->>'amount_cents')::int, case when e.data->>'status' = 'active' then 1 else 0 end) > 0) as paid_months,
      (select count(*) from services sv where sv.business_id = b.id and sv.active) as services,
      (select count(*) from professionals pr where pr.business_id = b.id and pr.active) as professionals,
      (select count(*) from appointments a where a.business_id = b.id and a.status <> 'cancelled') as appointments,
      (select count(*) from appointments a where a.business_id = b.id and a.status <> 'cancelled' and a.source = 'public') as online_appointments,
      (select count(*) from appointments a where a.business_id = b.id and a.status <> 'cancelled' and a.created_at >= now() - interval '7 days') as appointments_7d,
      (select count(*) from customers c where c.business_id = b.id) as customers
    from businesses b
    left join subscriptions s on s.business_id = b.id
    left join lateral (
      select m.user_id from business_members m where m.business_id = b.id and m.role = 'owner' order by m.created_at limit 1
    ) ow on true
    left join profiles o on o.id = ow.user_id
    left join auth.users u on u.id = ow.user_id
  ) t
$$;
revoke execute on function public.platform_accounts() from public, anon, authenticated;
grant execute on function public.platform_accounts() to service_role;
