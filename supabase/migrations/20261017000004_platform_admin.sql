-- Investimento em anúncios do próprio Só Marcar (para calcular CAC e ROI no painel do dono do SaaS).
-- Sem políticas RLS: só o servidor (service_role) lê e escreve.
create table public.marketing_spend (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  channel text not null check (char_length(channel) between 2 and 60),
  amount_cents integer not null check (amount_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (month, channel)
);
alter table public.marketing_spend enable row level security;
revoke all on public.marketing_spend from anon, authenticated;
grant all on public.marketing_spend to service_role;

-- Resumo da plataforma (somente service_role)
create or replace function public.platform_summary(p_from timestamptz, p_to timestamptz) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'businesses', (select count(*) from businesses),
    'new_businesses', (select count(*) from businesses where created_at >= p_from and created_at < p_to),
    'trialing', (select count(*) from subscriptions where status = 'trialing' and trial_ends_at > now()),
    'active', (select count(*) from subscriptions where status = 'active'),
    'past_due', (select count(*) from subscriptions where status = 'past_due'),
    'canceled', (select count(*) from subscriptions where status in ('canceled','expired')),
    'mrr_cents', (select coalesce(sum(price_cents), 0) from subscriptions where status in ('active','past_due')),
    'appointments', (select count(*) from appointments where starts_at >= p_from and starts_at < p_to and status <> 'cancelled'),
    'online_appointments', (select count(*) from appointments where starts_at >= p_from and starts_at < p_to and status <> 'cancelled' and source = 'public'),
    'clients_revenue_cents', (select coalesce(sum(price_cents), 0) from appointments where starts_at >= p_from and starts_at < p_to and status = 'completed'),
    'ad_spend_cents', (select coalesce(sum(amount_cents), 0) from marketing_spend where month >= date_trunc('month', p_from) and month < p_to),
    'top_businesses', coalesce((
      select jsonb_agg(t) from (
        select b.name, b.slug, b.segment, s.status,
          (select coalesce(sum(a.price_cents), 0) from appointments a where a.business_id = b.id and a.status = 'completed' and a.starts_at >= p_from and a.starts_at < p_to) as revenue_cents,
          (select count(*) from appointments a where a.business_id = b.id and a.status <> 'cancelled' and a.starts_at >= p_from and a.starts_at < p_to) as appointments
        from businesses b left join subscriptions s on s.business_id = b.id
        order by revenue_cents desc nulls last, appointments desc limit 20
      ) t), '[]'::jsonb)
  )
$$;
revoke execute on function public.platform_summary(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.platform_summary(timestamptz, timestamptz) to service_role;
