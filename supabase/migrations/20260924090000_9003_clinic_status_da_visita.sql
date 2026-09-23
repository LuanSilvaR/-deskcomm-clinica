-- ════════════════════════════════════════════════════════════════════════════
-- 9003 · clinic — status da visita do paciente agendado (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Vale só para agendamento COM paciente. Estados:
--   agendado → na_recepcao → pronto → em_atendimento → finalizado
--
--   na_recepcao     o paciente chegou e está com a recepção
--   pronto          a recepção terminou: o profissional pode chamar
--   em_atendimento  o profissional começou
--   finalizado      o profissional terminou (a aplicação grava `completed` no núcleo)
--   agendado        só aparece como CORREÇÃO (desfazer a chegada)
--
-- clinic_appointment_visits        — o estado ATUAL (1 linha por agendamento)
-- clinic_appointment_visit_events  — o histórico APPEND-ONLY (de → para, quem,
--                                    quando, motivo): é a auditoria simples.
-- fn_clinic_mudar_status_visita    — muda os dois de uma vez (security invoker:
--                                    a RLS de quem chama vale).
--
-- Substitui clinic_appointment_arrivals (9002): as chegadas registradas viram
-- visitas em `na_recepcao` e eventos, e a tabela antiga sai. Idempotente.

-- ─── estado atual ──────────────────────────────────────────────────────────
create table if not exists public.clinic_appointment_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.calendar_appointments(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  status text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  arrived_at timestamptz,
  ready_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint clinic_appointment_visits_agendamento_key unique (appointment_id),
  constraint clinic_appointment_visits_status_check
    check (status in ('agendado','na_recepcao','pronto','em_atendimento','finalizado'))
);
create index if not exists clinic_appointment_visits_org_status_idx
  on public.clinic_appointment_visits (organization_id, status, changed_at desc);

-- ─── histórico (append-only) ───────────────────────────────────────────────
create table if not exists public.clinic_appointment_visit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.calendar_appointments(id) on delete cascade,
  from_status text,
  to_status text not null,
  is_correction boolean not null default false,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint clinic_appointment_visit_events_para_check
    check (to_status in ('agendado','na_recepcao','pronto','em_atendimento','finalizado')),
  constraint clinic_appointment_visit_events_de_check
    check (from_status is null or from_status in ('agendado','na_recepcao','pronto','em_atendimento','finalizado')),
  constraint clinic_appointment_visit_events_motivo_tamanho check (reason is null or char_length(reason) <= 300),
  -- voltar um passo é correção, e correção precisa dizer por quê
  constraint clinic_appointment_visit_events_correcao_com_motivo
    check (not is_correction or char_length(btrim(coalesce(reason, ''))) >= 3)
);
create index if not exists clinic_appointment_visit_events_agendamento_idx
  on public.clinic_appointment_visit_events (organization_id, appointment_id, created_at);

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table public.clinic_appointment_visits enable row level security;
drop policy if exists tenant_isolation_clinic_appointment_visits_all on public.clinic_appointment_visits;
drop policy if exists clinic_appointment_visits_select on public.clinic_appointment_visits;
create policy clinic_appointment_visits_select on public.clinic_appointment_visits
  for select using ((organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin());
drop policy if exists clinic_appointment_visits_write on public.clinic_appointment_visits;
create policy clinic_appointment_visits_write on public.clinic_appointment_visits
  using (public.fn_is_platform_admin()
         or ((organization_id in (select public.fn_user_org_ids()))
             and public.fn_role_at_least(organization_id, 'agent')))
  with check (public.fn_is_platform_admin()
         or ((organization_id in (select public.fn_user_org_ids()))
             and public.fn_role_at_least(organization_id, 'agent')));
revoke all on public.clinic_appointment_visits from anon;

-- Histórico: lê quem é da org; INSERE atendente+; NINGUÉM altera nem apaga.
alter table public.clinic_appointment_visit_events enable row level security;
drop policy if exists tenant_isolation_clinic_appointment_visit_events_all on public.clinic_appointment_visit_events;
drop policy if exists clinic_appointment_visit_events_select on public.clinic_appointment_visit_events;
create policy clinic_appointment_visit_events_select on public.clinic_appointment_visit_events
  for select using ((organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin());
drop policy if exists clinic_appointment_visit_events_insert on public.clinic_appointment_visit_events;
create policy clinic_appointment_visit_events_insert on public.clinic_appointment_visit_events
  for insert with check (
    (organization_id in (select public.fn_user_org_ids()))
    and public.fn_role_at_least(organization_id, 'agent')
  );
revoke all on public.clinic_appointment_visit_events from anon;
revoke update, delete, truncate on public.clinic_appointment_visit_events from authenticated, service_role;

-- ─── a mudança de estado, atômica ──────────────────────────────────────────
create or replace function public.fn_clinic_mudar_status_visita(
  p_org uuid,
  p_appointment uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ordem constant text[] := array['agendado','na_recepcao','pronto','em_atendimento','finalizado'];
  v_ag record;
  v_atual text;
  v_correcao boolean;
begin
  if p_status is null or not (p_status = any (v_ordem)) then
    raise exception 'visita_status_invalido' using errcode = '22023';
  end if;

  select a.id, a.contact_id, a.status into v_ag
    from public.calendar_appointments a
   where a.id = p_appointment and a.organization_id = p_org;
  if not found then
    raise exception 'visita_agendamento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_ag.contact_id is null then
    raise exception 'visita_sem_paciente' using errcode = '22023';
  end if;
  if v_ag.status = 'cancelled' then
    raise exception 'visita_agendamento_cancelado' using errcode = '22023';
  end if;

  select v.status into v_atual
    from public.clinic_appointment_visits v
   where v.appointment_id = p_appointment and v.organization_id = p_org
   for update;
  v_atual := coalesce(v_atual, 'agendado');

  if v_atual = p_status then
    return jsonb_build_object('status', v_atual, 'mudou', false);
  end if;

  v_correcao := array_position(v_ordem, p_status) < array_position(v_ordem, v_atual);
  if v_correcao and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'visita_correcao_sem_motivo' using errcode = '22023';
  end if;

  insert into public.clinic_appointment_visits as v
    (organization_id, appointment_id, contact_id, status, changed_at, changed_by,
     arrived_at, ready_at, started_at, finished_at)
  values
    (p_org, p_appointment, v_ag.contact_id, p_status, now(), auth.uid(),
     case when p_status = 'na_recepcao' then now() end,
     case when p_status = 'pronto' then now() end,
     case when p_status = 'em_atendimento' then now() end,
     case when p_status = 'finalizado' then now() end)
  on conflict (appointment_id) do update
     set status = excluded.status,
         changed_at = now(),
         changed_by = auth.uid(),
         arrived_at  = case when excluded.status = 'na_recepcao'    then now() else v.arrived_at end,
         ready_at    = case when excluded.status = 'pronto'         then now() else v.ready_at end,
         started_at  = case when excluded.status = 'em_atendimento' then now() else v.started_at end,
         finished_at = case when excluded.status = 'finalizado'     then now() else v.finished_at end;

  insert into public.clinic_appointment_visit_events
    (organization_id, appointment_id, from_status, to_status, is_correction, reason, changed_by)
  values
    (p_org, p_appointment, v_atual, p_status, v_correcao, nullif(btrim(coalesce(p_reason, '')), ''), auth.uid());

  return jsonb_build_object('status', p_status, 'de', v_atual, 'mudou', true, 'correcao', v_correcao);
end $$;

revoke execute on function public.fn_clinic_mudar_status_visita(uuid, uuid, text, text) from public, anon;
grant  execute on function public.fn_clinic_mudar_status_visita(uuid, uuid, text, text) to authenticated, service_role;

-- ─── as chegadas da 9002 viram visitas, e a tabela antiga sai ─────────────
do $migra$
begin
  if to_regclass('public.clinic_appointment_arrivals') is not null then
    insert into public.clinic_appointment_visits
      (organization_id, appointment_id, contact_id, status, changed_at, changed_by, arrived_at)
    select a.organization_id, a.appointment_id, a.contact_id, 'na_recepcao', a.arrived_at, a.registered_by, a.arrived_at
      from public.clinic_appointment_arrivals a
    on conflict (appointment_id) do nothing;

    insert into public.clinic_appointment_visit_events
      (organization_id, appointment_id, from_status, to_status, changed_by, created_at)
    select a.organization_id, a.appointment_id, 'agendado', 'na_recepcao', a.registered_by, a.arrived_at
      from public.clinic_appointment_arrivals a
     where not exists (
       select 1 from public.clinic_appointment_visit_events e
        where e.appointment_id = a.appointment_id and e.to_status = 'na_recepcao'
     );

    drop table public.clinic_appointment_arrivals;
  end if;
end
$migra$;

-- ─── Realtime: o painel da recepção muda de coluna sem recarregar ─────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clinic_appointment_visits'
  ) then
    execute 'alter publication supabase_realtime add table public.clinic_appointment_visits';
  end if;
end $$;
