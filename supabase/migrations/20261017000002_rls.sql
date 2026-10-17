-- Só Marcar: segurança por linha (RLS). Cada usuário só enxerga os negócios dos quais é membro.

-- Funções auxiliares: security definer para não cair em recursão de RLS
create or replace function public.is_member(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business and user_id = auth.uid()
  )
$$;

create or replace function public.has_role(p_business uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business and user_id = auth.uid() and role = any(p_roles)
  )
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.services enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.webhook_events enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: cada um o seu
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_self_insert on public.profiles for insert to authenticated with check (id = auth.uid());

-- businesses: membros leem; owner/admin editam. Criação só pela função create_business.
create policy businesses_member_select on public.businesses for select to authenticated using (public.is_member(id));
create policy businesses_admin_update on public.businesses for update to authenticated
  using (public.has_role(id, array['owner','admin'])) with check (public.has_role(id, array['owner','admin']));

-- business_members: membros veem a equipe; só owner gerencia
create policy members_select on public.business_members for select to authenticated using (public.is_member(business_id));
create policy members_owner_insert on public.business_members for insert to authenticated
  with check (public.has_role(business_id, array['owner']) and role <> 'owner');
create policy members_owner_update on public.business_members for update to authenticated
  using (public.has_role(business_id, array['owner']) and role <> 'owner')
  with check (public.has_role(business_id, array['owner']) and role <> 'owner');
create policy members_owner_delete on public.business_members for delete to authenticated
  using (public.has_role(business_id, array['owner']) and role <> 'owner');

-- Configuração do negócio: membros leem, owner/admin escrevem
do $$
declare t text;
begin
  foreach t in array array['services','professionals','professional_services','working_hours','time_off'] loop
    execute format('create policy %1$s_member_select on public.%1$I for select to authenticated using (public.is_member(business_id))', t);
    execute format('create policy %1$s_admin_insert on public.%1$I for insert to authenticated with check (public.has_role(business_id, array[''owner'',''admin'']))', t);
    execute format('create policy %1$s_admin_update on public.%1$I for update to authenticated using (public.has_role(business_id, array[''owner'',''admin''])) with check (public.has_role(business_id, array[''owner'',''admin'']))', t);
    execute format('create policy %1$s_admin_delete on public.%1$I for delete to authenticated using (public.has_role(business_id, array[''owner'',''admin'']))', t);
  end loop;
end $$;

-- Profissional pode cadastrar as próprias folgas/bloqueios
create policy time_off_professional_own on public.time_off for all to authenticated
  using (public.is_member(business_id) and exists (
    select 1 from public.professionals p where p.id = professional_id and p.user_id = auth.uid()))
  with check (public.is_member(business_id) and exists (
    select 1 from public.professionals p where p.id = professional_id and p.user_id = auth.uid()));

-- Clientes e agendamentos: toda a equipe opera
create policy customers_member_all on public.customers for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));
create policy appointments_member_all on public.appointments for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));

-- Assinatura: só leitura para owner/admin. Escrita apenas pelo servidor (service_role).
create policy subscriptions_admin_select on public.subscriptions for select to authenticated
  using (public.has_role(business_id, array['owner','admin']));
create policy subscription_events_admin_select on public.subscription_events for select to authenticated
  using (exists (select 1 from public.subscriptions s where s.id = subscription_id and public.has_role(s.business_id, array['owner','admin'])));

-- Notificações e auditoria: leitura para owner/admin
create policy notification_jobs_admin_select on public.notification_jobs for select to authenticated
  using (public.has_role(business_id, array['owner','admin']));
create policy audit_logs_admin_select on public.audit_logs for select to authenticated
  using (public.has_role(business_id, array['owner','admin']));

-- webhook_events: sem política = ninguém além do service_role acessa

-- Privilégios básicos (RLS decide as linhas)
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.subscriptions, public.subscription_events, public.webhook_events,
  public.notification_jobs, public.audit_logs from authenticated;
revoke all on public.webhook_events from authenticated;
revoke all on all tables in schema public from anon;
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to authenticated, service_role;
