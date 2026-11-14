-- ════════════════════════════════════════════════════════════════════════════
-- 9017 · clinic — o ATENDIMENTO clínico (FORK, prontuário F1)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/plano.md (seções 4–7, fase F1).
--
-- Agendamento ≠ atendimento. O agendamento é a reserva de horário; o
-- ATENDIMENTO é o evento clínico que nasce quando o profissional clica em
-- "Iniciar atendimento" (visita `pronto` → `em_atendimento`, 9003). Os registros
-- clínicos das próximas fases (anamnese, evolução, procedimentos) penduram-se
-- nele.
--
--   clinic_atendimentos          um por agendamento (appointment_id unique)
--   clinic_atendimento_eventos   append-only: iniciado/finalizado/reaberto/anulado
--
-- Leitura: membro da empresa COM `prontuario.ver` (chave clínica, 9016) — sem
-- atalho de platform admin. Escrita: só pelas funções abaixo, que exigem a
-- permissão, MFA e suporte com escrita (`fn_acesso_exigir`) e a opção
-- `settings.clinic.prontuario` ligada. Idempotente.

-- ─── atendimento ───────────────────────────────────────────────────────────
create table if not exists public.clinic_atendimentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  appointment_id uuid references public.calendar_appointments(id) on delete restrict,
  professional_user_id uuid references auth.users(id) on delete set null,
  specialty_id uuid references public.clinic_specialties(id) on delete set null,
  event_type_id uuid references public.calendar_event_types(id) on delete set null,
  status text not null default 'em_andamento',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  finalizado_por uuid references auth.users(id) on delete set null,
  versao integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint clinic_atendimentos_status_check check (status in ('em_andamento', 'finalizado', 'anulado')),
  constraint clinic_atendimentos_finalizado_check check ((status = 'finalizado') = (finished_at is not null)),
  constraint clinic_atendimentos_org_id_key unique (organization_id, id),
  constraint clinic_atendimentos_agendamento_key unique (appointment_id)
);
create index if not exists clinic_atendimentos_paciente_idx
  on public.clinic_atendimentos (organization_id, contact_id, started_at desc);
create index if not exists clinic_atendimentos_profissional_idx
  on public.clinic_atendimentos (organization_id, professional_user_id, started_at desc);

drop trigger if exists clinic_atendimentos_updated_at on public.clinic_atendimentos;
create trigger clinic_atendimentos_updated_at before update on public.clinic_atendimentos
  for each row execute function public.fn_set_updated_at();

-- ─── eventos (append-only) ─────────────────────────────────────────────────
create table if not exists public.clinic_atendimento_eventos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  atendimento_id uuid not null,
  tipo text not null,
  status_antes text,
  status_depois text not null,
  motivo text,
  ator uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint clinic_atendimento_eventos_tipo_check check (tipo in ('iniciado', 'finalizado', 'reaberto', 'anulado')),
  constraint clinic_atendimento_eventos_motivo_tamanho check (motivo is null or char_length(motivo) <= 300),
  constraint clinic_atendimento_eventos_do_atendimento foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id) on delete cascade
);
create index if not exists clinic_atendimento_eventos_atendimento_idx
  on public.clinic_atendimento_eventos (organization_id, atendimento_id, created_at);

-- ─── RLS ───────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['clinic_atendimentos','clinic_atendimento_eventos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format('drop policy if exists %s_select on public.%I', t, t);
    -- Sem `or fn_is_platform_admin()`: conteúdo clínico não tem atalho.
    execute format($p$create policy %s_select on public.%I for select using (
        (organization_id in (select public.fn_user_org_ids()))
        and public.fn_has_permission(organization_id, 'prontuario.ver'))$p$, t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;
revoke update, delete, truncate on public.clinic_atendimento_eventos from service_role;

-- ─── iniciar ───────────────────────────────────────────────────────────────
create or replace function public.fn_clinic_iniciar_atendimento(p_org uuid, p_appointment uuid, p_specialty uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  select a.id, a.contact_id, a.status, a.event_type_id into v_ag
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

  select c.id, c.status into v_existente
    from public.clinic_atendimentos c
   where c.organization_id = p_org and c.appointment_id = p_appointment;
  if found then
    if v_existente.status = 'em_andamento' then
      return jsonb_build_object('id', v_existente.id, 'criado', false);
    end if;
    raise exception 'atendimento_ja_encerrado' using errcode = '22023';
  end if;

  -- Especialidade: a informada tem de ser do profissional; senão, a única que
  -- casa o que o tipo exige com o que o profissional tem.
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

  perform public.fn_clinic_mudar_status_visita(p_org, p_appointment, 'em_atendimento', null);

  return jsonb_build_object('id', v_id, 'criado', true);
end $$;
revoke execute on function public.fn_clinic_iniciar_atendimento(uuid, uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_iniciar_atendimento(uuid, uuid, uuid) to authenticated;

-- ─── finalizar ─────────────────────────────────────────────────────────────
-- Só o registro do atendimento. A visita (`finalizado`) e o "Compareceu" do
-- núcleo são gravados pela rota, pelo mesmo caminho da recepção.
create or replace function public.fn_clinic_finalizar_atendimento(p_org uuid, p_atendimento uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_at record;
begin
  perform public.fn_acesso_exigir(p_org, 'atendimento.finalizar');

  select c.id, c.status, c.appointment_id into v_at
    from public.clinic_atendimentos c
   where c.id = p_atendimento and c.organization_id = p_org
   for update;
  if not found then
    raise exception 'atendimento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_at.status = 'finalizado' then
    return jsonb_build_object('id', v_at.id, 'appointment_id', v_at.appointment_id, 'mudou', false);
  end if;
  if v_at.status <> 'em_andamento' then
    raise exception 'atendimento_ja_encerrado' using errcode = '22023';
  end if;

  update public.clinic_atendimentos
     set status = 'finalizado', finished_at = now(), finalizado_por = auth.uid(),
         updated_by = auth.uid(), versao = versao + 1
   where id = v_at.id;

  insert into public.clinic_atendimento_eventos (organization_id, atendimento_id, tipo, status_antes, status_depois, ator)
  values (p_org, v_at.id, 'finalizado', 'em_andamento', 'finalizado', auth.uid());

  return jsonb_build_object('id', v_at.id, 'appointment_id', v_at.appointment_id, 'mudou', true);
end $$;
revoke execute on function public.fn_clinic_finalizar_atendimento(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_finalizar_atendimento(uuid, uuid) to authenticated;
