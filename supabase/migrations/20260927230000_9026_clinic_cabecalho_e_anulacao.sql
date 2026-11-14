-- ════════════════════════════════════════════════════════════════════════════
-- 9026 · clinic — cabeçalho clínico do paciente e anular atendimento (FORK, F9)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/plano.md (seções 6, 9 e 14; fase de acabamento).
--
-- 1. CABEÇALHO CLÍNICO. `clinic_prontuarios`: uma linha por paciente com as
--    ALERGIAS INFORMADAS e os ALERTAS fixos que todo profissional precisa ver
--    no topo do atendimento e do prontuário. Toda mudança deixa rastro em
--    `clinic_prontuario_alteracoes` (append-only: valor anterior, novo, quem,
--    quando) — alergia é informação de segurança do paciente, não se perde.
--
-- 2. ANULAR ATENDIMENTO aberto por engano (paciente errado, clique errado):
--    só com o atendimento em andamento e SEM nenhum registro clínico; fica
--    `anulado` com motivo e evento, e a visita volta para "pronto" (correção
--    com motivo, pelo caminho da recepção). Para o mesmo agendamento poder ser
--    iniciado de novo, a unicidade do agendamento passa a ignorar os anulados.
--
-- Leitura com `prontuario.ver`, sem atalho de platform admin. Escrita só por
-- função. Idempotente.

-- ─── cabeçalho ─────────────────────────────────────────────────────────────
create table if not exists public.clinic_prontuarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id),
  alergias text,
  alertas text,
  versao integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint clinic_prontuarios_tamanhos check (coalesce(char_length(alergias), 0) <= 2000 and coalesce(char_length(alertas), 0) <= 2000),
  constraint clinic_prontuarios_paciente_key unique (organization_id, contact_id)
);
drop trigger if exists clinic_prontuarios_updated_at on public.clinic_prontuarios;
create trigger clinic_prontuarios_updated_at before update on public.clinic_prontuarios
  for each row execute function public.fn_set_updated_at();

create table if not exists public.clinic_prontuario_alteracoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id),
  campo text not null,
  valor_anterior text,
  valor_novo text,
  autor uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint clinic_prontuario_alteracoes_campo_check check (campo in ('alergias', 'alertas'))
);
create index if not exists clinic_prontuario_alteracoes_paciente_idx
  on public.clinic_prontuario_alteracoes (organization_id, contact_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['clinic_prontuarios','clinic_prontuario_alteracoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format('drop policy if exists %s_select on public.%I', t, t);
    execute format($p$create policy %s_select on public.%I for select using (
        (organization_id in (select public.fn_user_org_ids()))
        and public.fn_has_permission(organization_id, 'prontuario.ver'))$p$, t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;
revoke update, delete, truncate on public.clinic_prontuario_alteracoes from service_role;

create or replace function public.fn_clinic_cabecalho_salvar(
  p_org uuid, p_contact uuid, p_alergias text, p_alertas text, p_versao_esperada integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_atual record;
  v_alergias text := nullif(btrim(coalesce(p_alergias, '')), '');
  v_alertas text := nullif(btrim(coalesce(p_alertas, '')), '');
  v_versao integer;
begin
  perform public.fn_acesso_exigir(p_org, 'atendimento.registrar');
  if not coalesce((select (o.settings -> 'clinic' -> 'prontuario') = 'true'::jsonb from public.organizations o where o.id = p_org), false) then
    raise exception 'prontuario_desligado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.contacts c where c.id = p_contact and c.organization_id = p_org) then
    raise exception 'cabecalho_paciente_invalido' using errcode = '22023';
  end if;

  select p.alergias, p.alertas, p.versao into v_atual
    from public.clinic_prontuarios p
   where p.organization_id = p_org and p.contact_id = p_contact
   for update;
  if not found then
    if coalesce(p_versao_esperada, 0) <> 0 then
      raise exception 'registro_conflito' using errcode = '40001';
    end if;
    insert into public.clinic_prontuarios (organization_id, contact_id, alergias, alertas, updated_by)
    values (p_org, p_contact, v_alergias, v_alertas, auth.uid())
    returning versao into v_versao;
    -- Sem linha, `v_atual` fica com os campos nulos: tudo o que veio é "novo".
  else
    if v_atual.versao is distinct from p_versao_esperada then
      raise exception 'registro_conflito' using errcode = '40001';
    end if;
    update public.clinic_prontuarios
       set alergias = v_alergias, alertas = v_alertas, versao = versao + 1, updated_by = auth.uid()
     where organization_id = p_org and contact_id = p_contact
    returning versao into v_versao;
  end if;

  if v_alergias is distinct from v_atual.alergias then
    insert into public.clinic_prontuario_alteracoes (organization_id, contact_id, campo, valor_anterior, valor_novo, autor)
    values (p_org, p_contact, 'alergias', v_atual.alergias, v_alergias, auth.uid());
  end if;
  if v_alertas is distinct from v_atual.alertas then
    insert into public.clinic_prontuario_alteracoes (organization_id, contact_id, campo, valor_anterior, valor_novo, autor)
    values (p_org, p_contact, 'alertas', v_atual.alertas, v_alertas, auth.uid());
  end if;
  return jsonb_build_object('versao', v_versao);
end $$;
revoke execute on function public.fn_clinic_cabecalho_salvar(uuid, uuid, text, text, integer) from public, anon;
grant  execute on function public.fn_clinic_cabecalho_salvar(uuid, uuid, text, text, integer) to authenticated;

-- ─── anular atendimento aberto por engano ──────────────────────────────────
alter table public.clinic_atendimentos drop constraint if exists clinic_atendimentos_agendamento_key;
create unique index if not exists clinic_atendimentos_agendamento_vivo_key
  on public.clinic_atendimentos (appointment_id) where appointment_id is not null and status <> 'anulado';

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

  perform public.fn_clinic_mudar_status_visita(p_org, p_appointment, 'em_atendimento', null);

  return jsonb_build_object('id', v_id, 'criado', true);
end $$;
revoke execute on function public.fn_clinic_iniciar_atendimento(uuid, uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_iniciar_atendimento(uuid, uuid, uuid) to authenticated;

create or replace function public.fn_clinic_anular_atendimento(p_org uuid, p_atendimento uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_at record;
begin
  perform public.fn_acesso_exigir(p_org, 'atendimento.finalizar');
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'atendimento_sem_motivo' using errcode = '22023';
  end if;
  select c.id, c.status, c.appointment_id into v_at
    from public.clinic_atendimentos c
   where c.id = p_atendimento and c.organization_id = p_org
   for update;
  if not found then
    raise exception 'atendimento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_at.status <> 'em_andamento' then
    raise exception 'atendimento_ja_encerrado' using errcode = '22023';
  end if;
  -- Com qualquer registro clínico, não é "aberto por engano": finalize e use adendo.
  if exists (select 1 from public.clinic_formularios_preenchidos x where x.atendimento_id = v_at.id)
     or exists (select 1 from public.clinic_evolucoes x where x.atendimento_id = v_at.id)
     or exists (select 1 from public.clinic_condutas x where x.atendimento_id = v_at.id)
     or exists (select 1 from public.clinic_procedimentos_realizados x where x.atendimento_id = v_at.id and x.status <> 'anulado')
     or exists (select 1 from public.clinic_anexos x where x.atendimento_id = v_at.id and x.status = 'ativo')
     or exists (select 1 from public.clinic_documentos_emitidos x where x.atendimento_id = v_at.id and x.status in ('emitido', 'aceito')) then
    raise exception 'atendimento_com_registros' using errcode = '22023';
  end if;

  update public.clinic_atendimentos set status = 'anulado', updated_by = auth.uid(), versao = versao + 1 where id = v_at.id;
  insert into public.clinic_atendimento_eventos (organization_id, atendimento_id, tipo, status_antes, status_depois, motivo, ator)
  values (p_org, v_at.id, 'anulado', 'em_andamento', 'anulado', left(btrim(p_motivo), 300), auth.uid());
  if v_at.appointment_id is not null then
    -- Correção de status da visita (volta um passo), com o motivo — trilha da recepção.
    perform public.fn_clinic_mudar_status_visita(p_org, v_at.appointment_id, 'pronto', left(btrim(p_motivo), 300));
  end if;
  return jsonb_build_object('id', v_at.id);
end $$;
revoke execute on function public.fn_clinic_anular_atendimento(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_anular_atendimento(uuid, uuid, text) to authenticated;
