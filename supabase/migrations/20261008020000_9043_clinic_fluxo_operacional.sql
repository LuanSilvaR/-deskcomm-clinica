-- ════════════════════════════════════════════════════════════════════════════
-- 9043 · clinic — agenda: fluxo operacional (FORK, agenda S4)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: agenda da clínica, Sprint 4 (recepção → profissional).
--
-- 1. `clinic_agenda_historico`: o histórico do AGENDAMENTO (criado, confirmado,
--    remarcado, cancelado com motivo, faltou, realizado, troca de profissional),
--    escrito por trigger em `calendar_appointments` (sem HTTP). Append-only. A
--    visita segue com o dela (`clinic_appointment_visit_events`).
-- 2. `fn_clinic_mudar_status_visita` passa a security definer e decide QUEM:
--      • recepção (`recepcao.mudar_status_visita`): agendado → em recepção →
--        pronto; correção com `recepcao.corrigir_status`;
--      • em atendimento e finalizado: SÓ o profissional do agendamento;
--      • sair de finalizado: o próprio profissional no MESMO DIA (fuso da
--        organização) ou quem tem `atendimento.reabrir`.
--    Chamadas internas (iniciar/reabrir) ligam `clinic.visita_interna`; anular
--    (volta a "pronto") segue a regra: só o profissional.
-- 3. Iniciar atendimento: só o dono do agendamento. Finalizar: só quem iniciou.
--    Reabrir: a gerência (como antes) OU o próprio profissional no mesmo dia; a
--    visita volta a "em atendimento" junto.
-- 4. As tabelas da visita deixam de aceitar escrita direta (PostgREST): só pela
--    função.
-- Idempotente.

-- ─── 1. histórico do agendamento ───────────────────────────────────────────────
create table if not exists public.clinic_agenda_historico (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.calendar_appointments(id) on delete cascade,
  tipo text not null,
  status_antes text,
  status_depois text,
  inicio_antes timestamptz,
  inicio_depois timestamptz,
  motivo text,
  ator uuid,
  created_at timestamptz not null default now(),
  constraint clinic_agenda_historico_tipo check (
    tipo in ('criado', 'confirmado', 'pendente', 'remarcado', 'cancelado', 'faltou', 'realizado', 'profissional_trocado')),
  constraint clinic_agenda_historico_motivo check (motivo is null or char_length(motivo) <= 500)
);
create index if not exists clinic_agenda_historico_ag_idx
  on public.clinic_agenda_historico (organization_id, appointment_id, created_at);

alter table public.clinic_agenda_historico enable row level security;
-- Só LEITURA pela sessão: quem escreve é o trigger (security definer).
drop policy if exists tenant_isolation_clinic_agenda_historico_all on public.clinic_agenda_historico;
drop policy if exists tenant_isolation_clinic_agenda_historico_select on public.clinic_agenda_historico;
create policy tenant_isolation_clinic_agenda_historico_select on public.clinic_agenda_historico
  for select using (organization_id in (select public.fn_user_org_ids()));
revoke all on public.clinic_agenda_historico from anon;
revoke insert, update, delete, truncate on public.clinic_agenda_historico from authenticated;
revoke update, delete, truncate on public.clinic_agenda_historico from service_role;

create or replace function public.fn_clinic_agenda_historico_registrar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo text;
begin
  if tg_op = 'INSERT' then
    insert into public.clinic_agenda_historico
      (organization_id, appointment_id, tipo, status_depois, inicio_depois, ator)
    values (new.organization_id, new.id, 'criado', new.status, new.starts_at, auth.uid());
    return new;
  end if;
  if new.starts_at is distinct from old.starts_at then
    insert into public.clinic_agenda_historico
      (organization_id, appointment_id, tipo, status_antes, status_depois, inicio_antes, inicio_depois, ator)
    values (new.organization_id, new.id, 'remarcado', old.status, new.status, old.starts_at, new.starts_at, auth.uid());
  end if;
  if new.owner_user_id is distinct from old.owner_user_id then
    insert into public.clinic_agenda_historico
      (organization_id, appointment_id, tipo, status_antes, status_depois, ator)
    values (new.organization_id, new.id, 'profissional_trocado', old.status, new.status, auth.uid());
  end if;
  if new.status is distinct from old.status then
    v_tipo := case new.status
      when 'confirmed' then 'confirmado' when 'pending' then 'pendente' when 'cancelled' then 'cancelado'
      when 'no_show' then 'faltou' when 'completed' then 'realizado' end;
    if v_tipo is not null then
      insert into public.clinic_agenda_historico
        (organization_id, appointment_id, tipo, status_antes, status_depois, motivo, ator)
      values (new.organization_id, new.id, v_tipo, old.status, new.status,
              case when new.status = 'cancelled' then left(new.cancellation_reason, 500) end, auth.uid());
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_agenda_historico_registrar() from public, anon, authenticated;

drop trigger if exists trg_clinic_agenda_historico on public.calendar_appointments;
create trigger trg_clinic_agenda_historico
  after insert or update of status, starts_at, owner_user_id on public.calendar_appointments
  for each row execute function public.fn_clinic_agenda_historico_registrar();

-- ─── 2. status da visita: quem pode cada passo ─────────────────────────────────
create or replace function public.fn_clinic_mudar_status_visita(p_org uuid, p_appointment uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ordem constant text[] := array['agendado','na_recepcao','pronto','em_atendimento','finalizado'];
  v_ag record;
  v_atual text;
  v_fim timestamptz;
  v_correcao boolean;
  v_dono boolean;
  v_interna boolean := coalesce(current_setting('clinic.visita_interna', true), '') = 'on';
  v_fuso text;
begin
  if p_status is null or not (p_status = any (v_ordem)) then
    raise exception 'visita_status_invalido' using errcode = '22023';
  end if;
  if auth.uid() is null or p_org is null
     or not public.fn_role_at_least(p_org, 'agent')
     or not public.fn_support_write_allowed(p_org) then
    raise exception 'acesso_proibido' using errcode = '42501';
  end if;

  select a.id, a.contact_id, a.status, a.owner_user_id into v_ag
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

  select v.status, v.finished_at into v_atual, v_fim
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

  v_dono := v_ag.owner_user_id is not distinct from auth.uid();

  if not v_interna then
    -- depois de finalizado: o próprio profissional no mesmo dia, ou a gerência
    if v_atual = 'finalizado' then
      select coalesce(nullif(o.timezone, ''), 'America/Sao_Paulo') into v_fuso from public.organizations o where o.id = p_org;
      if not (public.fn_has_permission(p_org, 'atendimento.reabrir')
              or (v_dono and (coalesce(v_fim, now()) at time zone v_fuso)::date = (now() at time zone v_fuso)::date)) then
        raise exception 'visita_finalizada_bloqueada' using errcode = '42501';
      end if;
    -- atendimento clínico: começar, terminar ou desfazer é do profissional
    elsif (not v_correcao and p_status in ('em_atendimento', 'finalizado')) or v_atual = 'em_atendimento' then
      if not v_dono then
        raise exception 'visita_so_o_profissional' using errcode = '42501';
      end if;
    -- recepção: chegada e pronto; correção com a chave própria
    elsif not v_dono then
      if not public.fn_has_permission(p_org, 'recepcao.mudar_status_visita') then
        raise exception 'acesso_proibido' using errcode = '42501', detail = 'recepcao.mudar_status_visita';
      end if;
      if v_correcao and not public.fn_has_permission(p_org, 'recepcao.corrigir_status') then
        raise exception 'acesso_proibido' using errcode = '42501', detail = 'recepcao.corrigir_status';
      end if;
    end if;
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
grant execute on function public.fn_clinic_mudar_status_visita(uuid, uuid, text, text) to authenticated, service_role;

-- As tabelas da visita só mudam pela função (que decide quem pode o quê).
revoke insert, update, delete, truncate on public.clinic_appointment_visits from authenticated;
revoke insert, update, delete, truncate on public.clinic_appointment_visit_events from authenticated;

-- ─── 3. iniciar: só o profissional do agendamento ─────────────────────────────
create or replace function public.fn_clinic_iniciar_atendimento(p_org uuid, p_appointment uuid, p_specialty uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_ag record;
  v_existente record;
  v_especialidade uuid;
  v_id uuid;
begin
  perform public.fn_acesso_exigir(p_org, 'atendimento.iniciar');
  if not coalesce((select (o.settings -> 'clinic' -> 'prontuario') = 'true'::jsonb from public.organizations o where o.id = p_org), false) then
    raise exception 'prontuario_desligado' using errcode = '42501';
  end if;

  select a.id, a.contact_id, a.status, a.event_type_id, a.owner_user_id into v_ag
    from public.calendar_appointments a
   where a.id = p_appointment and a.organization_id = p_org
   for update;
  if not found then
    raise exception 'atendimento_agendamento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_ag.contact_id is null then
    raise exception 'atendimento_sem_paciente' using errcode = '22023';
  end if;
  if v_ag.status in ('cancelled', 'no_show') then
    raise exception 'atendimento_agendamento_cancelado' using errcode = '22023';
  end if;
  -- 9043: só o PROFISSIONAL RESPONSÁVEL (dono do agendamento) inicia.
  if v_ag.owner_user_id is distinct from auth.uid() then
    raise exception 'atendimento_so_o_profissional' using errcode = '42501';
  end if;

  -- Anulado (aberto por engano) não conta: o agendamento pode ser iniciado de novo.
  select c.id, c.status into v_existente
    from public.clinic_atendimentos c
   where c.organization_id = p_org and c.appointment_id = p_appointment and c.status <> 'anulado';
  if found then
    if v_existente.status = 'em_andamento' then
      return jsonb_build_object('id', v_existente.id, 'criado', false);
    end if;
    raise exception 'atendimento_ja_encerrado' using errcode = '22023';
  end if;

  if p_specialty is not null then
    if not exists (
      select 1 from public.clinic_professional_specialties ps
        join public.clinic_professionals p on p.id = ps.professional_id and p.organization_id = ps.organization_id
       where ps.organization_id = p_org and p.user_id = auth.uid() and ps.specialty_id = p_specialty
    ) then
      raise exception 'atendimento_especialidade_invalida' using errcode = '22023';
    end if;
    v_especialidade := p_specialty;
  else
    select min(ps.specialty_id::text)::uuid into v_especialidade
      from public.clinic_professional_specialties ps
      join public.clinic_professionals p on p.id = ps.professional_id and p.organization_id = ps.organization_id
     where ps.organization_id = p_org and p.user_id = auth.uid()
       and (v_ag.event_type_id is null or not exists (
              select 1 from public.clinic_event_type_specialties e
               where e.organization_id = p_org and e.event_type_id = v_ag.event_type_id)
            or ps.specialty_id in (
              select e.specialty_id from public.clinic_event_type_specialties e
               where e.organization_id = p_org and e.event_type_id = v_ag.event_type_id))
    having count(*) = 1;
  end if;

  insert into public.clinic_atendimentos
    (organization_id, contact_id, appointment_id, professional_user_id, specialty_id, event_type_id, created_by, updated_by)
  values
    (p_org, v_ag.contact_id, p_appointment, auth.uid(), v_especialidade, v_ag.event_type_id, auth.uid(), auth.uid())
  returning id into v_id;

  insert into public.clinic_atendimento_eventos (organization_id, atendimento_id, tipo, status_antes, status_depois, ator)
  values (p_org, v_id, 'iniciado', null, 'em_andamento', auth.uid());

  perform set_config('clinic.visita_interna', 'on', true);
  perform public.fn_clinic_mudar_status_visita(p_org, p_appointment, 'em_atendimento', null);
  perform set_config('clinic.visita_interna', '', true);

  return jsonb_build_object('id', v_id, 'criado', true);
end $$;

revoke execute on function public.fn_clinic_iniciar_atendimento(uuid, uuid, uuid) from public, anon;

-- ─── finalizar: só quem iniciou ───────────────────────────────────────────────
create or replace function public.fn_clinic_finalizar_atendimento(p_org uuid, p_atendimento uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_at record;
  v_faltam text[];
begin
  perform public.fn_acesso_exigir(p_org, 'atendimento.finalizar');
  select c.id, c.status, c.appointment_id, c.professional_user_id into v_at
    from public.clinic_atendimentos c
   where c.id = p_atendimento and c.organization_id = p_org
   for update;
  if not found then
    raise exception 'atendimento_nao_encontrado' using errcode = 'P0002';
  end if;
  -- 9043: só o profissional que iniciou finaliza.
  if v_at.professional_user_id is distinct from auth.uid() then
    raise exception 'atendimento_so_o_profissional' using errcode = '42501';
  end if;
  if v_at.status = 'finalizado' then
    return jsonb_build_object('id', v_at.id, 'appointment_id', v_at.appointment_id, 'mudou', false);
  end if;
  if v_at.status <> 'em_andamento' then
    raise exception 'atendimento_ja_encerrado' using errcode = '22023';
  end if;

  v_faltam := public.fn_clinic_requisitos_faltando(v_at.id);
  if cardinality(v_faltam) > 0 then
    raise exception 'requisitos_pendentes' using errcode = '23514', detail = array_to_string(v_faltam, ',');
  end if;

  perform public.fn_clinic_congelar_registros(v_at.id);

  update public.clinic_atendimentos
     set status = 'finalizado', finished_at = now(), finalizado_por = auth.uid(),
         updated_by = auth.uid(), versao = versao + 1
   where id = v_at.id;
  insert into public.clinic_atendimento_eventos (organization_id, atendimento_id, tipo, status_antes, status_depois, ator)
  values (p_org, v_at.id, 'finalizado', 'em_andamento', 'finalizado', auth.uid());
  return jsonb_build_object('id', v_at.id, 'appointment_id', v_at.appointment_id, 'mudou', true);
end $$;
revoke execute on function public.fn_clinic_finalizar_atendimento(uuid, uuid) from public, anon;

-- ─── reabrir: gerência, ou o próprio profissional no mesmo dia ─────────────────
create or replace function public.fn_clinic_reabrir_atendimento(p_org uuid, p_atendimento uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_at record;
  v_fuso text;
  v_mesmo_dia boolean;
begin
  if auth.uid() is null or p_org is null or not public.fn_support_write_allowed(p_org) then
    raise exception 'acesso_proibido' using errcode = '42501';
  end if;
  if not public.fn_session_mfa_proven() then
    raise exception 'acesso_mfa_exigido' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'atendimento_sem_motivo' using errcode = '22023';
  end if;
  select c.status, c.appointment_id, c.professional_user_id, c.finished_at into v_at
    from public.clinic_atendimentos c
   where c.id = p_atendimento and c.organization_id = p_org
   for update;
  if not found then
    raise exception 'atendimento_nao_encontrado' using errcode = 'P0002';
  end if;
  select coalesce(nullif(o.timezone, ''), 'America/Sao_Paulo') into v_fuso from public.organizations o where o.id = p_org;
  v_mesmo_dia := (coalesce(v_at.finished_at, now()) at time zone v_fuso)::date = (now() at time zone v_fuso)::date;
  if not (public.fn_has_permission(p_org, 'atendimento.reabrir')
          or (v_at.professional_user_id = auth.uid() and v_mesmo_dia
              and public.fn_has_permission(p_org, 'atendimento.finalizar'))) then
    raise exception 'acesso_proibido' using errcode = '42501', detail = 'atendimento.reabrir';
  end if;
  if v_at.status <> 'finalizado' then
    raise exception 'atendimento_nao_finalizado' using errcode = '22023';
  end if;
  update public.clinic_atendimentos
     set status = 'em_andamento', finished_at = null, finalizado_por = null, updated_by = auth.uid(), versao = versao + 1
   where id = p_atendimento;
  insert into public.clinic_atendimento_eventos (organization_id, atendimento_id, tipo, status_antes, status_depois, motivo, ator)
  values (p_org, p_atendimento, 'reaberto', 'finalizado', 'em_andamento', left(btrim(p_motivo), 300), auth.uid());
  -- A visita acompanha: volta a "em atendimento" (antes ficava "finalizado").
  if exists (select 1 from public.clinic_appointment_visits v
              where v.appointment_id = v_at.appointment_id and v.status = 'finalizado') then
    perform set_config('clinic.visita_interna', 'on', true);
    perform public.fn_clinic_mudar_status_visita(p_org, v_at.appointment_id, 'em_atendimento', left(btrim(p_motivo), 300));
    perform set_config('clinic.visita_interna', '', true);
  end if;
  return jsonb_build_object('id', p_atendimento);
end $$;
revoke execute on function public.fn_clinic_reabrir_atendimento(uuid, uuid, text) from public, anon;
