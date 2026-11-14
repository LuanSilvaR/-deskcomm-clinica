-- ════════════════════════════════════════════════════════════════════════════
-- 9004 · clinic — confirmação de consulta pelo WhatsApp (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Com `organizations.settings.clinic.confirmacao_automatica` ligada (nasce
-- DESLIGADA), o lembrete da véspera pede "Responda SIM ou NÃO" e registra um
-- pedido aqui. A resposta é lida por um consumidor de `message.received`
-- (lib/clinic/confirmacao/resposta.handler.ts); sem resposta até 4 h antes da
-- consulta, um cron abre uma TAREFA para a recepção ligar.
--
--   aguardando    pedido enviado, sem resposta ainda
--   confirmado    o paciente respondeu SIM
--   recusado      o paciente respondeu NÃO (tarefa: remarcar)
--   sem_resposta  chegou a 4 h da consulta sem resposta (tarefa: ligar)
--
-- A tarefa usa `crm_tasks` do núcleo (título, prazo, prioridade, paciente) e
-- não inventa vocabulário novo na Central. Idempotente.

create table if not exists public.clinic_confirmation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.calendar_appointments(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  status text not null default 'aguardando',
  requested_at timestamptz not null default now(),
  answered_at timestamptz,
  answer_message_id uuid references public.messages(id) on delete set null,
  task_id uuid references public.crm_tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_confirmation_requests_agendamento_key unique (appointment_id),
  constraint clinic_confirmation_requests_status_check
    check (status in ('aguardando','confirmado','recusado','sem_resposta'))
);
create index if not exists clinic_confirmation_requests_abertos_idx
  on public.clinic_confirmation_requests (organization_id, contact_id)
  where status in ('aguardando','sem_resposta');

drop trigger if exists clinic_confirmation_requests_updated_at on public.clinic_confirmation_requests;
create trigger clinic_confirmation_requests_updated_at before update on public.clinic_confirmation_requests
  for each row execute function public.fn_set_updated_at();

alter table public.clinic_confirmation_requests enable row level security;
drop policy if exists tenant_isolation_clinic_confirmation_requests_all on public.clinic_confirmation_requests;
drop policy if exists clinic_confirmation_requests_select on public.clinic_confirmation_requests;
create policy clinic_confirmation_requests_select on public.clinic_confirmation_requests
  for select using ((organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin());
drop policy if exists clinic_confirmation_requests_write on public.clinic_confirmation_requests;
create policy clinic_confirmation_requests_write on public.clinic_confirmation_requests
  using (public.fn_is_platform_admin()
         or ((organization_id in (select public.fn_user_org_ids()))
             and public.fn_role_at_least(organization_id, 'agent')))
  with check (public.fn_is_platform_admin()
         or ((organization_id in (select public.fn_user_org_ids()))
             and public.fn_role_at_least(organization_id, 'agent')));
revoke all on public.clinic_confirmation_requests from anon;

-- ─── a opção: organizations.settings.clinic.confirmacao_automatica ────────
create or replace function public.fn_clinic_definir_confirmacao_automatica(p_org uuid, p_ligado boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes boolean;
begin
  if auth.uid() is null
     or p_org is null
     or p_ligado is null
     or not public.fn_role_at_least(p_org, 'admin')
     or not public.fn_support_write_allowed(p_org) then
    raise exception 'clinic_flag_forbidden' using errcode = '42501';
  end if;
  if not public.fn_session_mfa_proven() then
    raise exception 'clinic_flag_mfa_required' using errcode = '42501';
  end if;

  select (o.settings -> 'clinic' -> 'confirmacao_automatica') = 'true'::jsonb into v_antes
    from public.organizations o
   where o.id = p_org;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  update public.organizations
     set settings = jsonb_set(
           coalesce(settings, '{}'::jsonb),
           '{clinic}',
           (case when jsonb_typeof(settings -> 'clinic') = 'object' then settings -> 'clinic' else '{}'::jsonb end)
             || jsonb_build_object('confirmacao_automatica', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;

revoke execute on function public.fn_clinic_definir_confirmacao_automatica(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_confirmacao_automatica(uuid, boolean) to authenticated;
