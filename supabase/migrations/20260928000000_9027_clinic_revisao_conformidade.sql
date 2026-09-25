-- ════════════════════════════════════════════════════════════════════════════
-- 9027 · clinic — correções das revisões de segurança/LGPD e de conformidade
--        de saúde (FORK, prontuário F10)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/entrega.md (seção "Revisões").
--
--  1. Suporte (impersonação) deixa de receber `documentos.*`: termo emitido
--     traz nome do paciente e procedimento — dado de saúde.
--  2. Termo de uso de imagem nunca tem opção obrigatória (consentimento livre,
--     LGPD art. 8º): trigger na versão do modelo.
--  3. Divulgação de foto passa a guardar e conferir os CANAIS autorizados
--     (redes sociais, site, material impresso), além da finalidade; leitura
--     revalida (termo vencido deixa de valer sem esperar ninguém).
--  4. Sem hard-delete direto de atendimento, cabeçalho e planos (nem por
--     service_role); a cascata da exclusão da empresa continua.
--  5. Anular atendimento grava na visita um motivo FIXO (a recepção lê).
--  6. Insumo ganha `registro_anvisa` (rastreabilidade).
-- Idempotente.

-- ─── 1. suporte sem documentos ─────────────────────────────────────────────
create or replace function public.fn_member_permissions(p_org uuid)
returns setof text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_suporte jsonb;
  v_papel text;
  v_ligado boolean;
  v_profissional boolean;
begin
  if auth.uid() is null or p_org is null then
    return;
  end if;

  v_suporte := public.fn_support_context();
  if v_suporte ->> 'status' = 'active' and (v_suporte ->> 'organization_id')::uuid = p_org then
    -- 9016: suporte nunca lê conteúdo clínico.
    -- 9027: nem os termos do paciente (nome + procedimento = dado de saúde).
    return query
      select c.key from public.clinic_permissions c
       where not c.clinica
         and c.modulo <> 'documentos'
         and (v_suporte ->> 'access_mode' = 'full' or c.nivel_base = 'viewer');
    return;
  end if;

  select uo.role into v_papel
    from public.user_organizations uo
   where uo.user_id = auth.uid() and uo.organization_id = p_org and uo.revoked_at is null
   limit 1;
  if v_papel is null then
    return;
  end if;

  select (o.settings -> 'clinic' -> 'acesso_por_permissoes') = 'true'::jsonb into v_ligado
    from public.organizations o where o.id = p_org;

  if not coalesce(v_ligado, false) then
    -- Transição: o que o nível legado já dava; chave clínica só para profissional ativo.
    select exists (
      select 1 from public.clinic_professionals p
       where p.organization_id = p_org and p.user_id = auth.uid() and p.is_active
    ) into v_profissional;
    return query
      select c.key from public.clinic_permissions c
       where public.fn_nivel_rank(c.nivel_base) <= public.fn_nivel_rank(v_papel)
         and (not c.clinica or v_profissional);
    return;
  end if;

  return query
    select distinct rp.permission_key
      from public.clinic_member_roles mr
      join public.clinic_roles r on r.organization_id = mr.organization_id and r.id = mr.role_id and r.ativo
      join public.clinic_role_permissions rp on rp.organization_id = r.organization_id and rp.role_id = r.id
      join public.clinic_permissions c on c.key = rp.permission_key
     where mr.organization_id = p_org and mr.user_id = auth.uid()
       -- 9016: o papel de sistema Administrador não concede conteúdo clínico.
       and not (c.clinica and r.system_key is not distinct from 'administrador');
end $$;
revoke execute on function public.fn_member_permissions(uuid) from public, anon;
grant  execute on function public.fn_member_permissions(uuid) to authenticated, service_role;

-- ─── 2. termo de uso de imagem: nenhuma opção obrigatória ──────────────────
create or replace function public.fn_clinic_modelo_imagem_sem_obrigatoria()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.clinic_modelos_documento m where m.id = new.modelo_id and m.tipo = 'uso_imagem')
     and exists (select 1 from jsonb_array_elements(coalesce(new.opcoes, '[]'::jsonb)) o
                  where coalesce((o ->> 'obrigatoria')::boolean, false)) then
    raise exception 'documento_opcao_obrigatoria_imagem' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_modelo_imagem_sem_obrigatoria() from public, anon, authenticated;
drop trigger if exists trg_clinic_modelo_imagem_sem_obrigatoria on public.clinic_modelos_documento_versoes;
create trigger trg_clinic_modelo_imagem_sem_obrigatoria before insert on public.clinic_modelos_documento_versoes
  for each row execute function public.fn_clinic_modelo_imagem_sem_obrigatoria();

-- ─── 3. divulgação: finalidade + canais ────────────────────────────────────
alter table public.clinic_anexos add column if not exists divulgacao_canais text[];
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_anexos_divulgacao_canais_check') then
    alter table public.clinic_anexos add constraint clinic_anexos_divulgacao_canais_check
      check (divulgacao_canais is null
             or (cardinality(divulgacao_canais) between 1 and 3
                 and divulgacao_canais <@ array['redes_sociais', 'site', 'material_impresso']::text[]));
  end if;
end $$;

-- Finalidade E cada canal autorizados por um termo de uso de imagem aceito,
-- no prazo e não revogado. Ponto único: marcar, revogar e ler usam esta.
create or replace function public.fn_clinic_divulgacao_autorizada(p_org uuid, p_contact uuid, p_opcao text, p_canais text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_opcao is not null and cardinality(coalesce(p_canais, '{}'::text[])) > 0
     and public.fn_clinic_uso_de_imagem_autorizado(p_org, p_contact, p_opcao)
     and not exists (select 1 from unnest(p_canais) c where not public.fn_clinic_uso_de_imagem_autorizado(p_org, p_contact, c))
$$;
revoke execute on function public.fn_clinic_divulgacao_autorizada(uuid, uuid, text, text[]) from public, anon, authenticated;

create or replace function public.fn_clinic_anexo_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() = 1 then
      raise exception 'prontuario_imutavel' using errcode = '55000';
    end if;
    return old;
  end if;
  if (to_jsonb(new) - array['status', 'anulado_motivo', 'divulgacao_opcao', 'divulgacao_canais', 'updated_at', 'updated_by', 'regiao', 'descricao', 'momento'])
     is distinct from (to_jsonb(old) - array['status', 'anulado_motivo', 'divulgacao_opcao', 'divulgacao_canais', 'updated_at', 'updated_by', 'regiao', 'descricao', 'momento'])
     or old.status = 'anulado' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_anexo_imutavel() from public, anon, authenticated;

create or replace function public.fn_clinic_anexo_mudar(p_org uuid, p_anexo uuid, p_acao text, p_valor text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select a.id, a.tipo, a.contact_id, a.status into v
    from public.clinic_anexos a where a.id = p_anexo and a.organization_id = p_org for update;
  if not found then
    raise exception 'anexo_nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.fn_acesso_exigir(p_org, case when v.tipo = 'foto' then 'fotos.enviar' else 'anexos.enviar' end);
  if v.status <> 'ativo' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  if p_acao = 'anular' then
    if char_length(btrim(coalesce(p_valor, ''))) < 3 then
      raise exception 'anexo_sem_motivo' using errcode = '22023';
    end if;
    update public.clinic_anexos
       set status = 'anulado', anulado_motivo = left(btrim(p_valor), 300), divulgacao_opcao = null, divulgacao_canais = null, updated_by = auth.uid()
     where id = p_anexo;
  elsif p_acao = 'divulgacao' then
    -- 9027: marcar exige os canais (fn_clinic_anexo_divulgar); aqui só desmarca.
    if p_valor is not null then
      raise exception 'anexo_canal_obrigatorio' using errcode = '22023';
    end if;
    update public.clinic_anexos set divulgacao_opcao = null, divulgacao_canais = null, updated_by = auth.uid() where id = p_anexo;
  else
    raise exception 'anexo_invalido' using errcode = '22023';
  end if;
end $$;
revoke execute on function public.fn_clinic_anexo_mudar(uuid, uuid, text, text) from public, anon;
grant  execute on function public.fn_clinic_anexo_mudar(uuid, uuid, text, text) to authenticated;

create or replace function public.fn_clinic_anexo_divulgar(p_org uuid, p_anexo uuid, p_opcao text, p_canais text[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select a.id, a.tipo, a.contact_id, a.status into v
    from public.clinic_anexos a where a.id = p_anexo and a.organization_id = p_org for update;
  if not found then
    raise exception 'anexo_nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.fn_acesso_exigir(p_org, 'fotos.enviar');
  if v.status <> 'ativo' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  if cardinality(coalesce(p_canais, '{}'::text[])) = 0
     or not (p_canais <@ array['redes_sociais', 'site', 'material_impresso']::text[]) then
    raise exception 'anexo_canal_obrigatorio' using errcode = '22023';
  end if;
  if v.tipo <> 'foto' or not public.fn_clinic_divulgacao_autorizada(p_org, v.contact_id, p_opcao, p_canais) then
    raise exception 'anexo_sem_autorizacao_de_imagem' using errcode = '42501';
  end if;
  update public.clinic_anexos
     set divulgacao_opcao = p_opcao, divulgacao_canais = (select array_agg(distinct c order by c) from unnest(p_canais) c),
         updated_by = auth.uid()
   where id = p_anexo;
end $$;
revoke execute on function public.fn_clinic_anexo_divulgar(uuid, uuid, text, text[]) from public, anon;
grant  execute on function public.fn_clinic_anexo_divulgar(uuid, uuid, text, text[]) to authenticated;

create or replace function public.fn_clinic_revogacao_desmarca_fotos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'uso_imagem' and new.status = 'revogado' and old.status <> 'revogado' then
    update public.clinic_anexos a
       set divulgacao_opcao = null, divulgacao_canais = null, updated_by = auth.uid()
     where a.organization_id = new.organization_id and a.contact_id = new.contact_id and a.status = 'ativo'
       and a.divulgacao_opcao is not null
       and not public.fn_clinic_divulgacao_autorizada(new.organization_id, new.contact_id, a.divulgacao_opcao, a.divulgacao_canais);
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_revogacao_desmarca_fotos() from public, anon, authenticated;

-- Leitura: quais fotos do paciente têm a marcação de divulgação VIGENTE agora
-- (termo pode ter vencido desde que foi marcado). Sem `fotos.ver`, nada.
create or replace function public.fn_clinic_divulgacao_vigente(p_org uuid, p_contact uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id from public.clinic_anexos a
   where a.organization_id = p_org and a.contact_id = p_contact and a.status = 'ativo'
     and a.divulgacao_opcao is not null
     and public.fn_has_permission(p_org, 'fotos.ver')
     and public.fn_clinic_divulgacao_autorizada(p_org, p_contact, a.divulgacao_opcao, a.divulgacao_canais)
$$;
revoke execute on function public.fn_clinic_divulgacao_vigente(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_divulgacao_vigente(uuid, uuid) to authenticated;

-- ─── 4. sem hard-delete direto ─────────────────────────────────────────────
-- Profundidade 1 = DELETE pedido direto (inclusive service_role/superusuário);
-- > 1 = cascata (exclusão da empresa), que continua valendo.
create or replace function public.fn_clinic_sem_delete_direto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() = 1 then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  return old;
end $$;
revoke execute on function public.fn_clinic_sem_delete_direto() from public, anon, authenticated;
do $$
declare
  t text;
begin
  foreach t in array array['clinic_atendimentos', 'clinic_prontuarios', 'clinic_planos_tratamento', 'clinic_plano_sessoes'] loop
    execute format('drop trigger if exists trg_%1$s_sem_delete on public.%1$I', t);
    execute format('create trigger trg_%1$s_sem_delete before delete on public.%1$I for each row execute function public.fn_clinic_sem_delete_direto()', t);
    execute format('revoke delete, truncate on public.%I from service_role, authenticated, anon', t);
  end loop;
end $$;

-- ─── 5. anular: motivo fixo na visita ──────────────────────────────────────
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
    -- Correção de status da visita (volta um passo). 9027: motivo FIXO — a
    -- recepção lê a trilha da visita; o motivo livre fica só no evento clínico.
    perform public.fn_clinic_mudar_status_visita(p_org, v_at.appointment_id, 'pronto', 'Atendimento anulado');
  end if;
  return jsonb_build_object('id', v_at.id);
end $$;
revoke execute on function public.fn_clinic_anular_atendimento(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_anular_atendimento(uuid, uuid, text) to authenticated;

-- ─── 6. insumo: registro na ANVISA ─────────────────────────────────────────
alter table public.clinic_procedimento_insumos add column if not exists registro_anvisa text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_insumos_registro_anvisa_tamanho') then
    alter table public.clinic_procedimento_insumos add constraint clinic_insumos_registro_anvisa_tamanho
      check (registro_anvisa is null or char_length(btrim(registro_anvisa)) between 1 and 40);
  end if;
end $$;

create or replace function public.fn_clinic_procedimento_salvar(
  p_org uuid, p_atendimento uuid, p_procedimento uuid, p_dados jsonb, p_insumos jsonb, p_versao_esperada integer)
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
  v_proc uuid := nullif(p_dados ->> 'procedure_id', '')::uuid;
  v_tipo uuid := nullif(p_dados ->> 'event_type_id', '')::uuid;
  v_sessao uuid := nullif(p_dados ->> 'plano_sessao_id', '')::uuid;
  v_i jsonb;
  v_prod uuid;
begin
  perform public.fn_acesso_exigir(p_org, 'atendimento.registrar');
  if not coalesce((select (o.settings -> 'clinic' -> 'prontuario') = 'true'::jsonb from public.organizations o where o.id = p_org), false) then
    raise exception 'prontuario_desligado' using errcode = '42501';
  end if;
  select c.id, c.status, c.contact_id into v_at
    from public.clinic_atendimentos c
   where c.id = p_atendimento and c.organization_id = p_org
   for update;
  if not found then
    raise exception 'atendimento_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_at.status <> 'em_andamento' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object'
     or p_insumos is null or jsonb_typeof(p_insumos) <> 'array' or jsonb_array_length(p_insumos) > 50
     or (v_proc is not null and not exists (select 1 from public.clinic_procedures x where x.id = v_proc and x.organization_id = p_org))
     or (v_tipo is not null and not exists (select 1 from public.calendar_event_types x where x.id = v_tipo and x.organization_id = p_org))
     or (v_sessao is not null and not exists (
           select 1 from public.clinic_plano_sessoes s
             join public.clinic_planos_tratamento p on p.id = s.plano_id
            where s.id = v_sessao and s.organization_id = p_org and p.contact_id = v_at.contact_id)) then
    raise exception 'procedimento_invalido' using errcode = '22023';
  end if;
  for v_i in select * from jsonb_array_elements(p_insumos) loop
    v_prod := nullif(v_i ->> 'product_id', '')::uuid;
    if v_prod is not null and not exists (select 1 from public.catalog_products x where x.id = v_prod and x.organization_id = p_org) then
      raise exception 'procedimento_invalido' using errcode = '22023';
    end if;
  end loop;

  if p_procedimento is null then
    insert into public.clinic_procedimentos_realizados
      (organization_id, atendimento_id, procedure_id, event_type_id, plano_sessao_id, descricao, regiao, parametros,
       intercorrencias, observacoes, executor_user_id, created_by, updated_by)
    values (p_org, p_atendimento, v_proc, v_tipo, v_sessao, btrim(p_dados ->> 'descricao'), nullif(btrim(p_dados ->> 'regiao'), ''),
            coalesce(p_dados -> 'parametros', '{}'::jsonb), nullif(btrim(p_dados ->> 'intercorrencias'), ''),
            nullif(btrim(p_dados ->> 'observacoes'), ''), auth.uid(), auth.uid(), auth.uid())
    returning id, versao into v_id, v_versao;
  else
    select x.id, x.versao, x.status into v_atual
      from public.clinic_procedimentos_realizados x
     where x.id = p_procedimento and x.organization_id = p_org and x.atendimento_id = p_atendimento
     for update;
    if not found then
      raise exception 'procedimento_nao_encontrado' using errcode = 'P0002';
    end if;
    if v_atual.status <> 'rascunho' then
      raise exception 'prontuario_imutavel' using errcode = '55000';
    end if;
    if v_atual.versao is distinct from p_versao_esperada then
      raise exception 'registro_conflito' using errcode = '40001';
    end if;
    update public.clinic_procedimentos_realizados
       set procedure_id = v_proc, event_type_id = v_tipo, plano_sessao_id = v_sessao, descricao = btrim(p_dados ->> 'descricao'),
           regiao = nullif(btrim(p_dados ->> 'regiao'), ''), parametros = coalesce(p_dados -> 'parametros', '{}'::jsonb),
           intercorrencias = nullif(btrim(p_dados ->> 'intercorrencias'), ''), observacoes = nullif(btrim(p_dados ->> 'observacoes'), ''),
           versao = versao + 1, updated_by = auth.uid()
     where id = p_procedimento
    returning id, versao into v_id, v_versao;
    delete from public.clinic_procedimento_insumos where procedimento_id = v_id;
  end if;

  insert into public.clinic_procedimento_insumos
    (organization_id, procedimento_id, product_id, descricao, quantidade, unidade, lote, validade, registro_anvisa)
  select p_org, v_id, nullif(i ->> 'product_id', '')::uuid, btrim(i ->> 'descricao'), (i ->> 'quantidade')::numeric,
         coalesce(nullif(btrim(i ->> 'unidade'), ''), 'un'), nullif(btrim(i ->> 'lote'), ''), nullif(i ->> 'validade', '')::date,
         nullif(btrim(i ->> 'registro_anvisa'), '')
    from jsonb_array_elements(p_insumos) i;

  return jsonb_build_object('id', v_id, 'versao', v_versao, 'criado', p_procedimento is null);
end $$;
revoke execute on function public.fn_clinic_procedimento_salvar(uuid, uuid, uuid, jsonb, jsonb, integer) from public, anon;
grant  execute on function public.fn_clinic_procedimento_salvar(uuid, uuid, uuid, jsonb, jsonb, integer) to authenticated;
