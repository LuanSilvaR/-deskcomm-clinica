-- ════════════════════════════════════════════════════════════════════════════
-- 9020 · clinic — requisitos de finalização e editor de modelos (FORK, prontuário F3)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/plano.md (fase F3).
--
-- 1. REQUISITOS DE FINALIZAÇÃO configuráveis. Cada regra diz "para finalizar,
--    a seção X precisa estar preenchida", valendo para a clínica toda, para um
--    tipo de atendimento, para uma especialidade ou para os dois juntos. Nada de
--    `if especialidade = ...` no código: o que muda por especialidade é LINHA
--    desta tabela. A evolução continua obrigatória sempre (mínimo legal).
--    `fn_clinic_requisitos_faltando` é o ponto único que diz o que falta; as
--    fases seguintes (conduta, procedimentos, documentos) só a redefinem.
--
-- 2. EDITOR DE MODELOS. Criar modelo, publicar nova versão (a anterior fica
--    intacta — quem preencheu com ela continua lendo os mesmos campos), mudar
--    nome/descrição/especialidades e ativar/desativar. Só com
--    `modelos_clinicos.gerenciar`, que é de configuração: não dá acesso a
--    paciente nenhum.
--
-- Escrita só por função. Idempotente.

-- ─── requisitos ────────────────────────────────────────────────────────────
create table if not exists public.clinic_requisitos_finalizacao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type_id uuid references public.calendar_event_types(id) on delete cascade,
  specialty_id uuid references public.clinic_specialties(id) on delete cascade,
  secao text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  -- As seções das fases seguintes já cabem aqui; cada fase liga a checagem da
  -- sua em fn_clinic_requisitos_faltando e a rota só aceita as que existem.
  constraint clinic_requisitos_finalizacao_secao_check
    check (secao in ('anamnese', 'avaliacao', 'conduta', 'procedimento', 'documento'))
);
create unique index if not exists clinic_requisitos_finalizacao_regra_key
  on public.clinic_requisitos_finalizacao (
    organization_id,
    coalesce(event_type_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(specialty_id, '00000000-0000-0000-0000-000000000000'::uuid),
    secao);
create index if not exists clinic_requisitos_finalizacao_org_idx
  on public.clinic_requisitos_finalizacao (organization_id);

alter table public.clinic_requisitos_finalizacao enable row level security;
drop policy if exists tenant_isolation_clinic_requisitos_finalizacao_all on public.clinic_requisitos_finalizacao;
drop policy if exists clinic_requisitos_finalizacao_select on public.clinic_requisitos_finalizacao;
-- Configuração, sem dado de paciente: qualquer membro lê.
create policy clinic_requisitos_finalizacao_select on public.clinic_requisitos_finalizacao for select using (
  organization_id in (select public.fn_user_org_ids()));
revoke all on public.clinic_requisitos_finalizacao from anon;
revoke insert, update, delete, truncate on public.clinic_requisitos_finalizacao from authenticated;

-- ─── o que falta para finalizar (ponto único) ─────────────────────────────
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

  -- Mínimo que nenhuma configuração tira: evolução com conteúdo.
  if not exists (
    select 1 from public.clinic_evolucoes e
     where e.atendimento_id = v_at.id
       and coalesce(nullif(btrim(e.resposta), ''), nullif(btrim(e.observacoes), ''), nullif(btrim(e.intercorrencias), ''),
                    nullif(btrim(e.orientacoes), ''), nullif(btrim(e.proxima_conduta), '')) is not null
  ) then
    v_faltam := array_append(v_faltam, 'evolucao');
  end if;

  -- Regras configuradas que valem para este atendimento.
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

  -- Formulário iniciado precisa ter os campos obrigatórios da versão usada.
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

  update public.clinic_formularios_preenchidos set status = 'finalizado', updated_by = auth.uid()
   where atendimento_id = v_at.id and status = 'rascunho';
  update public.clinic_evolucoes set status = 'finalizado', updated_by = auth.uid()
   where atendimento_id = v_at.id and status = 'rascunho';

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

-- Substitui TODAS as regras da empresa pelo conjunto informado (a tela edita a
-- lista inteira). p_regras = [{secao, event_type_id?, specialty_id?}].
create or replace function public.fn_clinic_definir_requisitos(p_org uuid, p_regras jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_r jsonb;
  v_n integer := 0;
  v_tipo uuid;
  v_esp uuid;
begin
  perform public.fn_acesso_exigir(p_org, 'modelos_clinicos.gerenciar');
  if p_regras is null or jsonb_typeof(p_regras) <> 'array' or jsonb_array_length(p_regras) > 200 then
    raise exception 'requisitos_invalidos' using errcode = '22023';
  end if;

  delete from public.clinic_requisitos_finalizacao where organization_id = p_org;
  for v_r in select * from jsonb_array_elements(p_regras) loop
    v_tipo := nullif(v_r ->> 'event_type_id', '')::uuid;
    v_esp := nullif(v_r ->> 'specialty_id', '')::uuid;
    -- Tipo e especialidade precisam ser da MESMA empresa.
    if v_tipo is not null and not exists (
      select 1 from public.calendar_event_types t where t.id = v_tipo and t.organization_id = p_org) then
      raise exception 'requisitos_invalidos' using errcode = '22023';
    end if;
    if v_esp is not null and not exists (
      select 1 from public.clinic_specialties s where s.id = v_esp and s.organization_id = p_org) then
      raise exception 'requisitos_invalidos' using errcode = '22023';
    end if;
    insert into public.clinic_requisitos_finalizacao (organization_id, event_type_id, specialty_id, secao, created_by)
    values (p_org, v_tipo, v_esp, v_r ->> 'secao', auth.uid())
    on conflict do nothing;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.fn_clinic_definir_requisitos(uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_definir_requisitos(uuid, jsonb) to authenticated;

-- ─── editor de modelos ─────────────────────────────────────────────────────
-- Forma mínima dos campos no banco (a validação fina é do código, em
-- lib/clinic/formularios/campos.ts): array de 1 a 60 objetos, cada um com
-- chave e tipo, chaves únicas, até 32 KB.
create or replace function public.fn_clinic_campos_validos(p_campos jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_typeof(p_campos) = 'array'
     and jsonb_array_length(p_campos) between 1 and 60
     and octet_length(p_campos::text) <= 32768
     and not exists (
       select 1 from jsonb_array_elements(p_campos) c
        where jsonb_typeof(c) <> 'object'
           or coalesce(c ->> 'chave', '') !~ '^[a-z][a-z0-9_]{0,39}$'
           or coalesce(c ->> 'tipo', '') not in
              ('texto', 'texto_longo', 'numero', 'data', 'sim_nao', 'escolha', 'multipla', 'escala'))
     and (select count(distinct c ->> 'chave') from jsonb_array_elements(p_campos) c) = jsonb_array_length(p_campos)
$$;
revoke execute on function public.fn_clinic_campos_validos(jsonb) from public, anon;

create or replace function public.fn_clinic_especialidades_da_org(p_org uuid, p_especialidades uuid[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(cardinality(p_especialidades), 0) <= 50
     and not exists (
       select 1 from unnest(coalesce(p_especialidades, '{}')) e
        where not exists (select 1 from public.clinic_specialties s where s.id = e and s.organization_id = p_org))
$$;
revoke execute on function public.fn_clinic_especialidades_da_org(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.fn_clinic_modelo_criar(
  p_org uuid, p_tipo text, p_nome text, p_descricao text, p_especialidades uuid[], p_campos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_versao uuid;
begin
  perform public.fn_acesso_exigir(p_org, 'modelos_clinicos.gerenciar');
  if p_tipo not in ('anamnese', 'avaliacao') or not public.fn_clinic_campos_validos(p_campos)
     or not public.fn_clinic_especialidades_da_org(p_org, p_especialidades) then
    raise exception 'modelo_invalido' using errcode = '22023';
  end if;
  insert into public.clinic_modelos_formulario (organization_id, tipo, nome, descricao, especialidades, created_by)
  values (p_org, p_tipo, btrim(p_nome), nullif(btrim(coalesce(p_descricao, '')), ''), coalesce(p_especialidades, '{}'), auth.uid())
  returning id into v_id;
  insert into public.clinic_modelos_formulario_versoes (organization_id, modelo_id, numero, campos, created_by)
  values (p_org, v_id, 1, p_campos, auth.uid())
  returning id into v_versao;
  return jsonb_build_object('id', v_id, 'versao_id', v_versao, 'numero', 1);
exception when unique_violation then
  raise exception 'modelo_nome_em_uso' using errcode = '23505';
end $$;
revoke execute on function public.fn_clinic_modelo_criar(uuid, text, text, text, uuid[], jsonb) from public, anon;
grant  execute on function public.fn_clinic_modelo_criar(uuid, text, text, text, uuid[], jsonb) to authenticated;

-- Nova versão: a anterior nunca muda. p_versao_esperada = versao_atual que a
-- tela conhecia; outra pessoa publicou antes → registro_conflito.
create or replace function public.fn_clinic_modelo_publicar_versao(
  p_org uuid, p_modelo uuid, p_campos jsonb, p_versao_esperada integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_atual integer;
  v_versao uuid;
begin
  perform public.fn_acesso_exigir(p_org, 'modelos_clinicos.gerenciar');
  if not public.fn_clinic_campos_validos(p_campos) then
    raise exception 'modelo_invalido' using errcode = '22023';
  end if;
  select m.versao_atual into v_atual
    from public.clinic_modelos_formulario m
   where m.id = p_modelo and m.organization_id = p_org
   for update;
  if not found then
    raise exception 'modelo_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_atual <> p_versao_esperada then
    raise exception 'registro_conflito' using errcode = '40001';
  end if;
  insert into public.clinic_modelos_formulario_versoes (organization_id, modelo_id, numero, campos, created_by)
  values (p_org, p_modelo, v_atual + 1, p_campos, auth.uid())
  returning id into v_versao;
  update public.clinic_modelos_formulario set versao_atual = v_atual + 1 where id = p_modelo;
  return jsonb_build_object('id', p_modelo, 'versao_id', v_versao, 'numero', v_atual + 1);
end $$;
revoke execute on function public.fn_clinic_modelo_publicar_versao(uuid, uuid, jsonb, integer) from public, anon;
grant  execute on function public.fn_clinic_modelo_publicar_versao(uuid, uuid, jsonb, integer) to authenticated;

create or replace function public.fn_clinic_modelo_atualizar(
  p_org uuid, p_modelo uuid, p_nome text, p_descricao text, p_especialidades uuid[], p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_acesso_exigir(p_org, 'modelos_clinicos.gerenciar');
  if not public.fn_clinic_especialidades_da_org(p_org, p_especialidades) then
    raise exception 'modelo_invalido' using errcode = '22023';
  end if;
  update public.clinic_modelos_formulario
     set nome = btrim(p_nome),
         descricao = nullif(btrim(coalesce(p_descricao, '')), ''),
         especialidades = coalesce(p_especialidades, '{}'),
         ativo = p_ativo
   where id = p_modelo and organization_id = p_org;
  if not found then
    raise exception 'modelo_nao_encontrado' using errcode = 'P0002';
  end if;
exception when unique_violation then
  raise exception 'modelo_nome_em_uso' using errcode = '23505';
end $$;
revoke execute on function public.fn_clinic_modelo_atualizar(uuid, uuid, text, text, uuid[], boolean) from public, anon;
grant  execute on function public.fn_clinic_modelo_atualizar(uuid, uuid, text, text, uuid[], boolean) to authenticated;
