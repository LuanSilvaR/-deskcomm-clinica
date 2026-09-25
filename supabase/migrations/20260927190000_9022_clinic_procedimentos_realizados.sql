-- ════════════════════════════════════════════════════════════════════════════
-- 9022 · clinic — procedimentos realizados e insumos (FORK, prontuário F5)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/plano.md (fase F5).
--
--   clinic_procedimentos_realizados  o que foi EXECUTADO no atendimento: qual
--                                    procedimento (catálogo da 9015), região,
--                                    parâmetros técnicos, intercorrências.
--   clinic_procedimento_insumos      o que foi gasto: produto (opcional),
--                                    quantidade, unidade, LOTE e VALIDADE —
--                                    rastreabilidade.
--
-- Estoque ainda não existe como movimentos (regra do repo: estoque = soma de
-- movimentos). Esta fase NÃO mexe em `catalog_products.quantidade`: ao
-- finalizar, cada procedimento vira um evento `clinic.procedimento_confirmado`
-- em `event_log` com os insumos (ids, quantidades, lote, validade — sem texto
-- clínico). Um consumidor de estoque futuro grava os movimentos e devolve o
-- `movimento_estoque_id`. Trigger não faz HTTP: só grava o evento.
--
-- Registro errado em atendimento aberto é ANULADO (nunca apagado). Depois de
-- finalizar, imutável; correção por adendo. Leitura com `prontuario.ver`.
-- Escrita só por função. Idempotente.

create table if not exists public.clinic_procedimentos_realizados (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  atendimento_id uuid not null,
  procedure_id uuid references public.clinic_procedures(id) on delete set null,
  event_type_id uuid references public.calendar_event_types(id) on delete set null,
  plano_sessao_id uuid references public.clinic_plano_sessoes(id) on delete set null,
  descricao text not null,
  regiao text,
  parametros jsonb not null default '{}'::jsonb,
  intercorrencias text,
  observacoes text,
  executor_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'rascunho',
  versao integer not null default 1,
  anulado_motivo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint clinic_proc_real_status_check check (status in ('rascunho', 'finalizado', 'anulado')),
  constraint clinic_proc_real_descricao_tamanho check (char_length(btrim(descricao)) between 1 and 200),
  constraint clinic_proc_real_tamanhos check (
    coalesce(char_length(regiao), 0) <= 200 and coalesce(char_length(intercorrencias), 0) <= 2000
    and coalesce(char_length(observacoes), 0) <= 2000 and coalesce(char_length(anulado_motivo), 0) <= 300),
  constraint clinic_proc_real_parametros_check check (jsonb_typeof(parametros) = 'object' and octet_length(parametros::text) <= 16384),
  constraint clinic_proc_real_org_id_key unique (organization_id, id),
  constraint clinic_proc_real_do_atendimento foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id) on delete cascade
);
create index if not exists clinic_proc_real_atendimento_idx
  on public.clinic_procedimentos_realizados (organization_id, atendimento_id, created_at);
drop trigger if exists clinic_proc_real_updated_at on public.clinic_procedimentos_realizados;
create trigger clinic_proc_real_updated_at before update on public.clinic_procedimentos_realizados
  for each row execute function public.fn_set_updated_at();
drop trigger if exists trg_clinic_proc_real_imutavel on public.clinic_procedimentos_realizados;
create trigger trg_clinic_proc_real_imutavel before update or delete on public.clinic_procedimentos_realizados
  for each row execute function public.fn_clinic_registro_imutavel();

create table if not exists public.clinic_procedimento_insumos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedimento_id uuid not null,
  product_id uuid references public.catalog_products(id) on delete set null,
  descricao text not null,
  quantidade numeric(12, 3) not null,
  unidade text not null default 'un',
  lote text,
  validade date,
  movimento_estoque_id uuid,
  created_at timestamptz not null default now(),
  constraint clinic_insumos_descricao_tamanho check (char_length(btrim(descricao)) between 1 and 200),
  constraint clinic_insumos_quantidade_check check (quantidade > 0),
  constraint clinic_insumos_unidade_tamanho check (char_length(btrim(unidade)) between 1 and 20),
  constraint clinic_insumos_lote_tamanho check (lote is null or char_length(btrim(lote)) between 1 and 60),
  constraint clinic_insumos_do_procedimento foreign key (organization_id, procedimento_id)
    references public.clinic_procedimentos_realizados (organization_id, id) on delete cascade
);
create index if not exists clinic_insumos_procedimento_idx on public.clinic_procedimento_insumos (organization_id, procedimento_id);
create index if not exists clinic_insumos_lote_idx on public.clinic_procedimento_insumos (organization_id, lote) where lote is not null;

-- Insumo acompanha o procedimento: só muda enquanto ele é rascunho em
-- atendimento aberto (o consumidor de estoque futuro só preenche o
-- movimento_estoque_id, pelo service role e com o procedimento finalizado).
create or replace function public.fn_clinic_insumo_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ok boolean;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.movimento_estoque_id is distinct from old.movimento_estoque_id
     and (to_jsonb(new) - 'movimento_estoque_id') = (to_jsonb(old) - 'movimento_estoque_id') then
    return new;
  end if;
  select p.status = 'rascunho' and a.status = 'em_andamento' into v_ok
    from public.clinic_procedimentos_realizados p
    join public.clinic_atendimentos a on a.id = p.atendimento_id
   where p.id = coalesce(old.procedimento_id, new.procedimento_id);
  if not coalesce(v_ok, false) then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.fn_clinic_insumo_imutavel() from public, anon, authenticated;
drop trigger if exists trg_clinic_insumo_imutavel on public.clinic_procedimento_insumos;
create trigger trg_clinic_insumo_imutavel before update or delete on public.clinic_procedimento_insumos
  for each row execute function public.fn_clinic_insumo_imutavel();

do $$
declare t text;
begin
  foreach t in array array['clinic_procedimentos_realizados','clinic_procedimento_insumos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;
drop policy if exists clinic_procedimentos_realizados_select on public.clinic_procedimentos_realizados;
create policy clinic_procedimentos_realizados_select on public.clinic_procedimentos_realizados for select using (
  (organization_id in (select public.fn_user_org_ids()))
  and public.fn_has_permission(organization_id, 'prontuario.ver'));
drop policy if exists clinic_procedimento_insumos_select on public.clinic_procedimento_insumos;
create policy clinic_procedimento_insumos_select on public.clinic_procedimento_insumos for select using (
  (organization_id in (select public.fn_user_org_ids()))
  and public.fn_has_permission(organization_id, 'prontuario.ver'));

-- Salva (cria com p_procedimento nulo, ou atualiza com versão) um procedimento
-- e TROCA a lista de insumos. p_dados = {descricao, procedure_id?,
-- event_type_id?, plano_sessao_id?, regiao?, parametros?, intercorrencias?,
-- observacoes?}; p_insumos = [{descricao, quantidade, unidade?, product_id?,
-- lote?, validade?}]. Tudo que aponta para outra tabela é conferido na MESMA
-- empresa.
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

  insert into public.clinic_procedimento_insumos (organization_id, procedimento_id, product_id, descricao, quantidade, unidade, lote, validade)
  select p_org, v_id, nullif(i ->> 'product_id', '')::uuid, btrim(i ->> 'descricao'), (i ->> 'quantidade')::numeric,
         coalesce(nullif(btrim(i ->> 'unidade'), ''), 'un'), nullif(btrim(i ->> 'lote'), ''), nullif(i ->> 'validade', '')::date
    from jsonb_array_elements(p_insumos) i;

  return jsonb_build_object('id', v_id, 'versao', v_versao, 'criado', p_procedimento is null);
end $$;
revoke execute on function public.fn_clinic_procedimento_salvar(uuid, uuid, uuid, jsonb, jsonb, integer) from public, anon;
grant  execute on function public.fn_clinic_procedimento_salvar(uuid, uuid, uuid, jsonb, jsonb, integer) to authenticated;

-- Registro errado, com o atendimento ainda aberto: anula (fica no histórico).
create or replace function public.fn_clinic_procedimento_anular(p_org uuid, p_procedimento uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_acesso_exigir(p_org, 'atendimento.registrar');
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'procedimento_sem_motivo' using errcode = '22023';
  end if;
  update public.clinic_procedimentos_realizados
     set status = 'anulado', anulado_motivo = left(btrim(p_motivo), 300), updated_by = auth.uid()
   where id = p_procedimento and organization_id = p_org and status = 'rascunho';
  if not found then
    raise exception 'procedimento_nao_encontrado' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function public.fn_clinic_procedimento_anular(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_procedimento_anular(uuid, uuid, text) to authenticated;

-- A imutabilidade compartilhada (9019) só deixa atualizar RASCUNHO; o
-- `anulado` também é final.
create or replace function public.fn_clinic_registro_imutavel()
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
  if old.status <> 'rascunho'
     or coalesce((select a.status from public.clinic_atendimentos a where a.id = old.atendimento_id), '') <> 'em_andamento' then
    raise exception 'prontuario_imutavel' using errcode = '55000';
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_registro_imutavel() from public, anon, authenticated;

-- ─── adendo também no procedimento ─────────────────────────────────────────
alter table public.clinic_adendos drop constraint if exists clinic_adendos_alvo_tipo_check;
alter table public.clinic_adendos add constraint clinic_adendos_alvo_tipo_check
  check (alvo_tipo in ('formulario', 'evolucao', 'conduta', 'procedimento'));

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
    or (p_alvo_tipo = 'procedimento' and exists (
       select 1 from public.clinic_procedimentos_realizados x
        where x.id = p_alvo_id and x.organization_id = p_org and x.atendimento_id = p_atendimento and x.status = 'finalizado'))
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

-- ─── requisitos: procedimento pode ser exigido ─────────────────────────────
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
  if 'procedimento' = any (v_exigidas) and not exists (
    select 1 from public.clinic_procedimentos_realizados x where x.atendimento_id = v_at.id and x.status <> 'anulado') then
    v_faltam := array_append(v_faltam, 'procedimento');
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

-- ─── congelar: procedimentos confirmados viram evento de estoque ───────────
create or replace function public.fn_clinic_congelar_registros(p_atendimento uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ag uuid;
  v_p record;
begin
  update public.clinic_formularios_preenchidos set status = 'finalizado', updated_by = auth.uid()
   where atendimento_id = p_atendimento and status = 'rascunho';
  update public.clinic_evolucoes set status = 'finalizado', updated_by = auth.uid()
   where atendimento_id = p_atendimento and status = 'rascunho';
  update public.clinic_condutas set status = 'finalizado', updated_by = auth.uid()
   where atendimento_id = p_atendimento and status = 'rascunho';

  for v_p in
    update public.clinic_procedimentos_realizados set status = 'finalizado', updated_by = auth.uid()
     where atendimento_id = p_atendimento and status = 'rascunho'
    returning id, organization_id, procedure_id, event_type_id
  loop
    -- Sem texto clínico no evento: ids, quantidades, lote e validade.
    insert into public.event_log (organization_id, event_type, entity_kind, entity_id, payload)
    values (
      v_p.organization_id, 'clinic.procedimento_confirmado', 'clinic_procedimento_realizado', v_p.id,
      jsonb_build_object(
        'atendimento_id', p_atendimento,
        'procedure_id', v_p.procedure_id,
        'event_type_id', v_p.event_type_id,
        'insumos', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'insumo_id', i.id, 'product_id', i.product_id, 'quantidade', i.quantidade,
                   'unidade', i.unidade, 'lote', i.lote, 'validade', i.validade) order by i.created_at)
            from public.clinic_procedimento_insumos i where i.procedimento_id = v_p.id), '[]'::jsonb)));
  end loop;

  select a.appointment_id into v_ag from public.clinic_atendimentos a where a.id = p_atendimento;
  if v_ag is not null then
    update public.clinic_plano_sessoes
       set status = 'realizada', atendimento_id = p_atendimento, realizada_em = now(), updated_by = auth.uid()
     where appointment_id = v_ag and status = 'agendada';
  end if;
end $$;
revoke execute on function public.fn_clinic_congelar_registros(uuid) from public, anon, authenticated;
