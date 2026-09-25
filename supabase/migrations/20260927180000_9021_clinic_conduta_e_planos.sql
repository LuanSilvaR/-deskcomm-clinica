-- ════════════════════════════════════════════════════════════════════════════
-- 9021 · clinic — conduta, plano de tratamento e sessões (FORK, prontuário F4)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/plano.md (fase F4).
--
--   clinic_condutas             a conduta do atendimento (uma por atendimento):
--                               o que foi decidido, protocolo, recomendações.
--                               Rascunho com versão; imutável ao finalizar;
--                               correção por adendo.
--   clinic_planos_tratamento    o plano do paciente (objetivo, período, status)
--   clinic_plano_sessoes        as sessões do plano. PLANEJADA ≠ AGENDADA ≠
--                               REALIZADA por construção: agendada tem
--                               agendamento; realizada tem o atendimento que a
--                               cumpriu. Vira realizada sozinha quando o
--                               atendimento daquele agendamento é finalizado.
--
-- Também: `fn_clinic_congelar_registros` passa a ser o ponto único do que a
-- finalização trava (as próximas fases só o redefinem), e a conduta entra nos
-- requisitos configuráveis e nos alvos de adendo.
--
-- Paciente, agendamento e atendimento referenciados sem ON DELETE (NO ACTION):
-- apagar um deles sozinho é recusado (registro clínico se guarda), mas a
-- exclusão da empresa, que leva tudo na mesma instrução, passa.
--
-- Leitura: condutas com `prontuario.ver`; planos com `planos.ver`. Sem atalho
-- de platform admin. Escrita só por função. Idempotente.

-- ─── conduta ───────────────────────────────────────────────────────────────
create table if not exists public.clinic_condutas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  atendimento_id uuid not null,
  descricao text,
  protocolo text,
  recomendacoes text,
  status text not null default 'rascunho',
  versao integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint clinic_condutas_status_check check (status in ('rascunho', 'finalizado')),
  constraint clinic_condutas_tamanhos check (
    coalesce(char_length(descricao), 0) <= 5000 and coalesce(char_length(protocolo), 0) <= 5000
    and coalesce(char_length(recomendacoes), 0) <= 5000),
  constraint clinic_condutas_atendimento_key unique (atendimento_id),
  constraint clinic_condutas_org_id_key unique (organization_id, id),
  constraint clinic_condutas_do_atendimento foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id) on delete cascade
);
drop trigger if exists clinic_condutas_updated_at on public.clinic_condutas;
create trigger clinic_condutas_updated_at before update on public.clinic_condutas
  for each row execute function public.fn_set_updated_at();
drop trigger if exists trg_clinic_conduta_imutavel on public.clinic_condutas;
create trigger trg_clinic_conduta_imutavel before update or delete on public.clinic_condutas
  for each row execute function public.fn_clinic_registro_imutavel();

alter table public.clinic_condutas enable row level security;
drop policy if exists tenant_isolation_clinic_condutas_all on public.clinic_condutas;
drop policy if exists clinic_condutas_select on public.clinic_condutas;
create policy clinic_condutas_select on public.clinic_condutas for select using (
  (organization_id in (select public.fn_user_org_ids()))
  and public.fn_has_permission(organization_id, 'prontuario.ver'));
revoke all on public.clinic_condutas from anon;
revoke insert, update, delete, truncate on public.clinic_condutas from authenticated;

create or replace function public.fn_clinic_salvar_conduta(
  p_org uuid, p_atendimento uuid, p_descricao text, p_protocolo text, p_recomendacoes text, p_versao_esperada integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_at record;
  v_atual record;
  v_id uuid;
  v_versao integer;
begin
  perform public.fn_acesso_exigir(p_org, 'atendimento.registrar');
  if not coalesce((select (o.settings -> 'clinic' -> 'prontuario') = 'true'::jsonb from public.organizations o where o.id = p_org), false) then
    raise exception 'prontuario_desligado' using errcode = '42501';
  end if;
  select c.id, c.status into v_at
    from public.clinic_atendimentos c
   where c.id = p_atendimento and c.organization_id = p_org
   for update;
  if not found then
    raise exception 'atendimento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_at.status <> 'em_andamento' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;

  select x.id, x.versao, x.status into v_atual
    from public.clinic_condutas x
   where x.organization_id = p_org and x.atendimento_id = p_atendimento
   for update;
  if not found then
    if coalesce(p_versao_esperada, 0) <> 0 then
      raise exception 'registro_conflito' using errcode = '40001';
    end if;
    insert into public.clinic_condutas (organization_id, atendimento_id, descricao, protocolo, recomendacoes, created_by, updated_by)
    values (p_org, p_atendimento, p_descricao, p_protocolo, p_recomendacoes, auth.uid(), auth.uid())
    returning id, versao into v_id, v_versao;
    return jsonb_build_object('id', v_id, 'versao', v_versao, 'criado', true);
  end if;
  if v_atual.status = 'finalizado' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  if v_atual.versao is distinct from p_versao_esperada then
    raise exception 'registro_conflito' using errcode = '40001', detail = v_atual.versao::text;
  end if;
  update public.clinic_condutas
     set descricao = p_descricao, protocolo = p_protocolo, recomendacoes = p_recomendacoes,
         versao = versao + 1, updated_by = auth.uid()
   where id = v_atual.id
  returning versao into v_versao;
  return jsonb_build_object('id', v_atual.id, 'versao', v_versao, 'criado', false);
end $$;
revoke execute on function public.fn_clinic_salvar_conduta(uuid, uuid, text, text, text, integer) from public, anon;
grant  execute on function public.fn_clinic_salvar_conduta(uuid, uuid, text, text, text, integer) to authenticated;

-- ─── plano de tratamento ───────────────────────────────────────────────────
create table if not exists public.clinic_planos_tratamento (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id),
  atendimento_origem_id uuid,
  profissional_user_id uuid references auth.users(id) on delete set null,
  specialty_id uuid references public.clinic_specialties(id) on delete set null,
  titulo text not null,
  objetivo text,
  observacoes text,
  inicio date,
  previsao_fim date,
  status text not null default 'ativo',
  versao integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint clinic_planos_status_check check (status in ('rascunho', 'ativo', 'pausado', 'concluido', 'cancelado')),
  constraint clinic_planos_titulo_tamanho check (char_length(btrim(titulo)) between 1 and 120),
  constraint clinic_planos_tamanhos check (coalesce(char_length(objetivo), 0) <= 2000 and coalesce(char_length(observacoes), 0) <= 2000),
  constraint clinic_planos_periodo check (previsao_fim is null or inicio is null or previsao_fim >= inicio),
  constraint clinic_planos_org_id_key unique (organization_id, id),
  constraint clinic_planos_do_atendimento foreign key (organization_id, atendimento_origem_id)
    references public.clinic_atendimentos (organization_id, id)
);
create index if not exists clinic_planos_paciente_idx
  on public.clinic_planos_tratamento (organization_id, contact_id, created_at desc);
drop trigger if exists clinic_planos_updated_at on public.clinic_planos_tratamento;
create trigger clinic_planos_updated_at before update on public.clinic_planos_tratamento
  for each row execute function public.fn_set_updated_at();

create table if not exists public.clinic_plano_sessoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plano_id uuid not null,
  numero integer not null,
  descricao text not null,
  event_type_id uuid references public.calendar_event_types(id) on delete set null,
  procedure_id uuid references public.clinic_procedures(id) on delete set null,
  previsao date,
  status text not null default 'planejada',
  appointment_id uuid references public.calendar_appointments(id),
  atendimento_id uuid,
  realizada_em timestamptz,
  cancelada_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint clinic_plano_sessoes_status_check check (status in ('planejada', 'agendada', 'realizada', 'cancelada')),
  constraint clinic_plano_sessoes_descricao_tamanho check (char_length(btrim(descricao)) between 1 and 200),
  constraint clinic_plano_sessoes_numero_check check (numero >= 1),
  -- PLANEJADO ≠ AGENDADO ≠ REALIZADO: cada estado tem o que o prova.
  constraint clinic_plano_sessoes_coerencia check (
    (status = 'planejada' and appointment_id is null and atendimento_id is null)
    or (status = 'agendada' and appointment_id is not null and atendimento_id is null)
    or (status = 'realizada' and atendimento_id is not null and realizada_em is not null)
    or (status = 'cancelada' and atendimento_id is null)),
  constraint clinic_plano_sessoes_plano_numero_key unique (plano_id, numero),
  constraint clinic_plano_sessoes_do_plano foreign key (organization_id, plano_id)
    references public.clinic_planos_tratamento (organization_id, id) on delete cascade,
  constraint clinic_plano_sessoes_do_atendimento foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id)
);
create unique index if not exists clinic_plano_sessoes_agendamento_key
  on public.clinic_plano_sessoes (appointment_id) where appointment_id is not null and status in ('agendada', 'realizada');
create index if not exists clinic_plano_sessoes_plano_idx on public.clinic_plano_sessoes (organization_id, plano_id, numero);
drop trigger if exists clinic_plano_sessoes_updated_at on public.clinic_plano_sessoes;
create trigger clinic_plano_sessoes_updated_at before update on public.clinic_plano_sessoes
  for each row execute function public.fn_set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['clinic_planos_tratamento','clinic_plano_sessoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;
drop policy if exists clinic_planos_tratamento_select on public.clinic_planos_tratamento;
create policy clinic_planos_tratamento_select on public.clinic_planos_tratamento for select using (
  (organization_id in (select public.fn_user_org_ids()))
  and public.fn_has_permission(organization_id, 'planos.ver'));
drop policy if exists clinic_plano_sessoes_select on public.clinic_plano_sessoes;
create policy clinic_plano_sessoes_select on public.clinic_plano_sessoes for select using (
  (organization_id in (select public.fn_user_org_ids()))
  and public.fn_has_permission(organization_id, 'planos.ver'));

-- Exigências comuns das funções de plano: permissão, opção ligada.
create or replace function public.fn_clinic_plano_exigir(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_acesso_exigir(p_org, 'planos.gerenciar');
  if not coalesce((select (o.settings -> 'clinic' -> 'prontuario') = 'true'::jsonb from public.organizations o where o.id = p_org), false) then
    raise exception 'prontuario_desligado' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.fn_clinic_plano_exigir(uuid) from public, anon, authenticated;

-- Cria (p_plano nulo) ou atualiza. Paciente, especialidade e atendimento de
-- origem conferidos na MESMA empresa; o atendimento tem de ser do paciente.
create or replace function public.fn_clinic_plano_salvar(
  p_org uuid, p_plano uuid, p_contact uuid, p_titulo text, p_objetivo text, p_observacoes text,
  p_inicio date, p_previsao_fim date, p_specialty uuid, p_atendimento_origem uuid, p_status text, p_versao_esperada integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_atual record;
  v_id uuid;
  v_versao integer;
begin
  perform public.fn_clinic_plano_exigir(p_org);
  if p_status not in ('rascunho', 'ativo', 'pausado', 'concluido', 'cancelado') then
    raise exception 'plano_invalido' using errcode = '22023';
  end if;
  if p_specialty is not null and not exists (
    select 1 from public.clinic_specialties s where s.id = p_specialty and s.organization_id = p_org) then
    raise exception 'plano_invalido' using errcode = '22023';
  end if;

  if p_plano is null then
    if not exists (select 1 from public.contacts c where c.id = p_contact and c.organization_id = p_org) then
      raise exception 'plano_paciente_invalido' using errcode = '22023';
    end if;
    if p_atendimento_origem is not null and not exists (
      select 1 from public.clinic_atendimentos a
       where a.id = p_atendimento_origem and a.organization_id = p_org and a.contact_id = p_contact) then
      raise exception 'plano_invalido' using errcode = '22023';
    end if;
    insert into public.clinic_planos_tratamento
      (organization_id, contact_id, atendimento_origem_id, profissional_user_id, specialty_id, titulo, objetivo,
       observacoes, inicio, previsao_fim, status, created_by, updated_by)
    values (p_org, p_contact, p_atendimento_origem, auth.uid(), p_specialty, btrim(p_titulo), nullif(btrim(coalesce(p_objetivo, '')), ''),
            nullif(btrim(coalesce(p_observacoes, '')), ''), p_inicio, p_previsao_fim, p_status, auth.uid(), auth.uid())
    returning id, versao into v_id, v_versao;
    return jsonb_build_object('id', v_id, 'versao', v_versao, 'criado', true);
  end if;

  select p.id, p.versao, p.status into v_atual
    from public.clinic_planos_tratamento p
   where p.id = p_plano and p.organization_id = p_org
   for update;
  if not found then
    raise exception 'plano_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_atual.versao is distinct from p_versao_esperada then
    raise exception 'registro_conflito' using errcode = '40001';
  end if;
  if v_atual.status = 'cancelado' and p_status <> 'cancelado' then
    raise exception 'plano_encerrado' using errcode = '22023';
  end if;
  update public.clinic_planos_tratamento
     set titulo = btrim(p_titulo), objetivo = nullif(btrim(coalesce(p_objetivo, '')), ''),
         observacoes = nullif(btrim(coalesce(p_observacoes, '')), ''), inicio = p_inicio, previsao_fim = p_previsao_fim,
         specialty_id = p_specialty, status = p_status, versao = versao + 1, updated_by = auth.uid()
   where id = p_plano
  returning versao into v_versao;
  return jsonb_build_object('id', p_plano, 'versao', v_versao, 'criado', false);
end $$;
revoke execute on function public.fn_clinic_plano_salvar(uuid, uuid, uuid, text, text, text, date, date, uuid, uuid, text, integer) from public, anon;
grant  execute on function public.fn_clinic_plano_salvar(uuid, uuid, uuid, text, text, text, date, date, uuid, uuid, text, integer) to authenticated;

-- Acrescenta N sessões PLANEJADAS, com previsão a cada `p_intervalo_dias`.
create or replace function public.fn_clinic_plano_adicionar_sessoes(
  p_org uuid, p_plano uuid, p_descricao text, p_event_type uuid, p_procedure uuid,
  p_quantidade integer, p_primeira date, p_intervalo_dias integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_ultimo integer;
  i integer;
begin
  perform public.fn_clinic_plano_exigir(p_org);
  if p_quantidade is null or p_quantidade not between 1 and 50 or coalesce(p_intervalo_dias, 0) not between 0 and 365 then
    raise exception 'plano_invalido' using errcode = '22023';
  end if;
  if p_event_type is not null and not exists (
    select 1 from public.calendar_event_types t where t.id = p_event_type and t.organization_id = p_org) then
    raise exception 'plano_invalido' using errcode = '22023';
  end if;
  if p_procedure is not null and not exists (
    select 1 from public.clinic_procedures x where x.id = p_procedure and x.organization_id = p_org) then
    raise exception 'plano_invalido' using errcode = '22023';
  end if;
  select p.status into v_status
    from public.clinic_planos_tratamento p where p.id = p_plano and p.organization_id = p_org for update;
  if not found then
    raise exception 'plano_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'plano_encerrado' using errcode = '22023';
  end if;
  select coalesce(max(s.numero), 0) into v_ultimo from public.clinic_plano_sessoes s where s.plano_id = p_plano;
  for i in 1..p_quantidade loop
    insert into public.clinic_plano_sessoes
      (organization_id, plano_id, numero, descricao, event_type_id, procedure_id, previsao, updated_by)
    values (p_org, p_plano, v_ultimo + i, btrim(p_descricao), p_event_type, p_procedure,
            case when p_primeira is null then null else p_primeira + ((i - 1) * coalesce(p_intervalo_dias, 0)) end,
            auth.uid());
  end loop;
  update public.clinic_planos_tratamento set versao = versao + 1, updated_by = auth.uid() where id = p_plano;
  return p_quantidade;
end $$;
revoke execute on function public.fn_clinic_plano_adicionar_sessoes(uuid, uuid, text, uuid, uuid, integer, date, integer) from public, anon;
grant  execute on function public.fn_clinic_plano_adicionar_sessoes(uuid, uuid, text, uuid, uuid, integer, date, integer) to authenticated;

-- agendar (planejada → agendada, com um agendamento do MESMO paciente),
-- desagendar (agendada → planejada) ou cancelar (planejada/agendada → cancelada,
-- com motivo). Realizada não muda mais.
create or replace function public.fn_clinic_plano_sessao_mudar(
  p_org uuid, p_sessao uuid, p_acao text, p_appointment uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s record;
  v_ag record;
begin
  perform public.fn_clinic_plano_exigir(p_org);
  select s.id, s.status, s.plano_id, p.contact_id, p.status as plano_status into v_s
    from public.clinic_plano_sessoes s
    join public.clinic_planos_tratamento p on p.id = s.plano_id
   where s.id = p_sessao and s.organization_id = p_org
   for update of s;
  if not found then
    raise exception 'plano_sessao_nao_encontrada' using errcode = 'P0002';
  end if;
  if v_s.status in ('realizada', 'cancelada') then
    raise exception 'plano_sessao_encerrada' using errcode = '22023';
  end if;

  if p_acao = 'agendar' then
    if v_s.plano_status in ('concluido', 'cancelado') then
      raise exception 'plano_encerrado' using errcode = '22023';
    end if;
    select a.id, a.contact_id, a.status into v_ag
      from public.calendar_appointments a where a.id = p_appointment and a.organization_id = p_org;
    if not found or v_ag.contact_id is distinct from v_s.contact_id or v_ag.status in ('cancelled', 'no_show') then
      raise exception 'plano_agendamento_invalido' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.clinic_plano_sessoes x
       where x.appointment_id = p_appointment and x.status in ('agendada', 'realizada') and x.id <> p_sessao) then
      raise exception 'plano_agendamento_em_uso' using errcode = '23505';
    end if;
    update public.clinic_plano_sessoes set status = 'agendada', appointment_id = p_appointment, updated_by = auth.uid()
     where id = p_sessao;
  elsif p_acao = 'desagendar' then
    update public.clinic_plano_sessoes set status = 'planejada', appointment_id = null, updated_by = auth.uid()
     where id = p_sessao;
  elsif p_acao = 'cancelar' then
    if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
      raise exception 'plano_sessao_sem_motivo' using errcode = '22023';
    end if;
    update public.clinic_plano_sessoes
       set status = 'cancelada', appointment_id = null, cancelada_motivo = left(btrim(p_motivo), 300), updated_by = auth.uid()
     where id = p_sessao;
  else
    raise exception 'plano_invalido' using errcode = '22023';
  end if;
  update public.clinic_planos_tratamento set versao = versao + 1, updated_by = auth.uid() where id = v_s.plano_id;
  return jsonb_build_object('id', p_sessao, 'acao', p_acao);
end $$;
revoke execute on function public.fn_clinic_plano_sessao_mudar(uuid, uuid, text, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_plano_sessao_mudar(uuid, uuid, text, uuid, text) to authenticated;

-- ─── adendo também na conduta ──────────────────────────────────────────────
alter table public.clinic_adendos drop constraint if exists clinic_adendos_alvo_tipo_check;
alter table public.clinic_adendos add constraint clinic_adendos_alvo_tipo_check
  check (alvo_tipo in ('formulario', 'evolucao', 'conduta'));

create or replace function public.fn_clinic_adicionar_adendo(
  p_org uuid, p_atendimento uuid, p_alvo_tipo text, p_alvo_id uuid, p_texto text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_id uuid;
begin
  perform public.fn_acesso_exigir(p_org, 'prontuario.adendo');
  select c.status into v_status
    from public.clinic_atendimentos c
   where c.id = p_atendimento and c.organization_id = p_org;
  if not found then
    raise exception 'atendimento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_status <> 'finalizado' then
    raise exception 'adendo_so_em_finalizado' using errcode = '22023';
  end if;
  if not (
    (p_alvo_tipo = 'formulario' and exists (
       select 1 from public.clinic_formularios_preenchidos f
        where f.id = p_alvo_id and f.organization_id = p_org and f.atendimento_id = p_atendimento))
    or (p_alvo_tipo = 'evolucao' and exists (
       select 1 from public.clinic_evolucoes e
        where e.id = p_alvo_id and e.organization_id = p_org and e.atendimento_id = p_atendimento))
    or (p_alvo_tipo = 'conduta' and exists (
       select 1 from public.clinic_condutas x
        where x.id = p_alvo_id and x.organization_id = p_org and x.atendimento_id = p_atendimento))
  ) then
    raise exception 'adendo_alvo_invalido' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'adendo_sem_motivo' using errcode = '22023';
  end if;
  insert into public.clinic_adendos (organization_id, atendimento_id, alvo_tipo, alvo_id, texto, motivo, autor)
  values (p_org, p_atendimento, p_alvo_tipo, p_alvo_id, btrim(p_texto), btrim(p_motivo), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.fn_clinic_adicionar_adendo(uuid, uuid, text, uuid, text, text) from public, anon;
grant  execute on function public.fn_clinic_adicionar_adendo(uuid, uuid, text, uuid, text, text) to authenticated;

-- ─── requisitos: a conduta passa a poder ser exigida ───────────────────────
create or replace function public.fn_clinic_requisitos_faltando(p_atendimento uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_at record;
  v_faltam text[] := '{}';
  v_exigidas text[];
begin
  select c.id, c.organization_id, c.event_type_id, c.specialty_id into v_at
    from public.clinic_atendimentos c where c.id = p_atendimento;
  if not found then
    return v_faltam;
  end if;

  if not exists (
    select 1 from public.clinic_evolucoes e
     where e.atendimento_id = v_at.id
       and coalesce(nullif(btrim(e.resposta), ''), nullif(btrim(e.observacoes), ''), nullif(btrim(e.intercorrencias), ''),
                    nullif(btrim(e.orientacoes), ''), nullif(btrim(e.proxima_conduta), '')) is not null
  ) then
    v_faltam := array_append(v_faltam, 'evolucao');
  end if;

  select coalesce(array_agg(distinct r.secao), '{}') into v_exigidas
    from public.clinic_requisitos_finalizacao r
   where r.organization_id = v_at.organization_id
     and (r.event_type_id is null or r.event_type_id = v_at.event_type_id)
     and (r.specialty_id is null or r.specialty_id = v_at.specialty_id);

  if 'anamnese' = any (v_exigidas) and not exists (
    select 1 from public.clinic_formularios_preenchidos f where f.atendimento_id = v_at.id and f.tipo = 'anamnese') then
    v_faltam := array_append(v_faltam, 'anamnese');
  end if;
  if 'avaliacao' = any (v_exigidas) and not exists (
    select 1 from public.clinic_formularios_preenchidos f where f.atendimento_id = v_at.id and f.tipo = 'avaliacao') then
    v_faltam := array_append(v_faltam, 'avaliacao');
  end if;
  if 'conduta' = any (v_exigidas) and not exists (
    select 1 from public.clinic_condutas x
     where x.atendimento_id = v_at.id
       and coalesce(nullif(btrim(x.descricao), ''), nullif(btrim(x.protocolo), ''), nullif(btrim(x.recomendacoes), '')) is not null) then
    v_faltam := array_append(v_faltam, 'conduta');
  end if;

  v_faltam := v_faltam || coalesce((
    select array_agg(f.tipo order by f.tipo)
      from public.clinic_formularios_preenchidos f
      join public.clinic_modelos_formulario_versoes v on v.id = f.modelo_versao_id
     where f.atendimento_id = v_at.id
       and not (f.tipo = any (v_faltam))
       and exists (
         select 1 from jsonb_array_elements(v.campos) c
          where coalesce((c ->> 'obrigatorio')::boolean, false)
            and (not (f.respostas ? (c ->> 'chave'))
                 or f.respostas -> (c ->> 'chave') in ('null'::jsonb, '""'::jsonb, '[]'::jsonb)))
  ), '{}');

  return v_faltam;
end $$;
revoke execute on function public.fn_clinic_requisitos_faltando(uuid) from public, anon, authenticated;

-- ─── o que a finalização trava (ponto único) ───────────────────────────────
create or replace function public.fn_clinic_congelar_registros(p_atendimento uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ag uuid;
begin
  update public.clinic_formularios_preenchidos set status = 'finalizado', updated_by = auth.uid()
   where atendimento_id = p_atendimento and status = 'rascunho';
  update public.clinic_evolucoes set status = 'finalizado', updated_by = auth.uid()
   where atendimento_id = p_atendimento and status = 'rascunho';
  update public.clinic_condutas set status = 'finalizado', updated_by = auth.uid()
   where atendimento_id = p_atendimento and status = 'rascunho';
  -- A sessão do plano ligada a este agendamento foi REALIZADA por este atendimento.
  select a.appointment_id into v_ag from public.clinic_atendimentos a where a.id = p_atendimento;
  if v_ag is not null then
    update public.clinic_plano_sessoes
       set status = 'realizada', atendimento_id = p_atendimento, realizada_em = now(), updated_by = auth.uid()
     where appointment_id = v_ag and status = 'agendada';
  end if;
end $$;
revoke execute on function public.fn_clinic_congelar_registros(uuid) from public, anon, authenticated;

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
grant  execute on function public.fn_clinic_finalizar_atendimento(uuid, uuid) to authenticated;
