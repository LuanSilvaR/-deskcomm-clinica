-- ════════════════════════════════════════════════════════════════════════════
-- 9038 · clinic — estoque: correções das revisões (FORK, estoque E10)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/estoque/plano.md ("E10"). As revisões security-lgpd e
-- health-compliance sobre E0–E9 acharam, sobretudo, furos de RASTREABILIDADE
-- do lote até o paciente. Aqui:
--
--   C1  insumo de produto rastreado exige lote e validade no prontuário; o que
--       a FEFO escolheu sozinha fica marcado `lote_presumido` no movimento;
--   C2  recall novo: parte dos INSUMOS do prontuário (o lote que o profissional
--       escreveu) unidos aos movimentos — acha estornado, pendente e sem baixa;
--   C3  NF-e com vários `rastro` num item vira um lote por rastro (soma conferida);
--   C4  lote vencido aplicado: baixa (o prontuário manda) e alerta de evento;
--   C5  conselho conferido também quando a baixa vira pendência e no resolver;
--       `outro` não vale como conselho de produto controlado;
--   C6  lote guarda registro ANVISA e fabricação da NF-e; registro divergente
--       do cadastro vira alerta;
--   C7  fracionável exige prazo pós-abertura (escrita nova);
--   C8  bloqueio de lote (recall/quarentena): fora da FEFO e da baixa manual;
--   C9  estorno não devolve conteúdo a frasco encerrado ou vencido;
--   C10 perda com categoria (vencimento, quebra, contaminação…);
--   C11 código de lote normalizado (maiúsculas, sem espaços nas pontas);
--   C13 quem só tem `estoque.ver` não lê a ligação indireta com o atendimento
--       (pendências, reservas, origem da operação) — privilégio por coluna;
--   S1  recall auditado e limitado DENTRO do banco (a RPC direta deixa de ser
--       um atalho sem registro); a versão antiga sai do alcance do cliente;
--   S2  custo sai da leitura direta de `estoque.ver` (lotes, movimentos, NF-e);
--   S4  registrar NF-e exige o XML no Storage da própria clínica.
--
-- Aditiva: colunas novas com default, constraints `not valid` (valem para a
-- escrita nova), funções redefinidas com a mesma assinatura ou criadas novas
-- (as antigas ficam). Também anexada ao fim de supabase/baseline.sql.

-- ─── 1. colunas novas ───────────────────────────────────────────────────────
alter table public.clinic_estoque_movimentos
  add column if not exists lote_presumido boolean not null default false;

alter table public.clinic_estoque_lotes
  add column if not exists registro_anvisa text,
  add column if not exists fabricacao date,
  add column if not exists bloqueado_em timestamptz,
  add column if not exists bloqueado_por uuid,
  add column if not exists bloqueio_motivo text;

alter table public.clinic_estoque_operacoes
  add column if not exists motivo_categoria text;

do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_estoque_lotes_revisao_textos') then
    alter table public.clinic_estoque_lotes add constraint clinic_estoque_lotes_revisao_textos check (
      coalesce(char_length(registro_anvisa), 0) <= 40
      and (bloqueio_motivo is null or char_length(btrim(bloqueio_motivo)) between 3 and 300));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_estoque_operacoes_motivo_categoria') then
    alter table public.clinic_estoque_operacoes add constraint clinic_estoque_operacoes_motivo_categoria check (
      motivo_categoria is null or motivo_categoria in
        ('vencimento', 'quebra', 'contaminacao', 'pos_abertura', 'recolhimento', 'outro'));
  end if;
  -- C7 e C5: valem para a escrita nova (dados antigos não são reavaliados)
  if not exists (select 1 from pg_constraint where conname = 'clinic_produto_estoque_fracionavel_prazo') then
    alter table public.clinic_produto_estoque add constraint clinic_produto_estoque_fracionavel_prazo
      check (not fracionavel or validade_pos_abertura_horas is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_produto_estoque_controlado_conselho') then
    alter table public.clinic_produto_estoque add constraint clinic_produto_estoque_controlado_conselho
      check (not controlado or not ('outro' = any(conselhos_permitidos))) not valid;
  end if;
  -- alertas de EVENTO (não vêm da varredura): ampliar a lista de tipos
  alter table public.clinic_estoque_alertas drop constraint if exists clinic_estoque_alertas_tipo;
  alter table public.clinic_estoque_alertas add constraint clinic_estoque_alertas_tipo check (tipo in (
    'abaixo_minimo', 'ponto_pedido', 'validade_proxima', 'lote_vencido', 'frasco_vencido', 'pendencias_baixa',
    'consumo_lote_vencido', 'lote_bloqueado_consumido', 'nfe_registro_divergente'));
end
$c$;

-- ─── 2. C11: código de lote normalizado na entrada ─────────────────────────
create or replace function public.fn_clinic_estoque_lote_normalizar()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.codigo := nullif(upper(btrim(coalesce(new.codigo, ''))), '');
  return new;
end $$;
revoke execute on function public.fn_clinic_estoque_lote_normalizar() from public, anon, authenticated;
drop trigger if exists trg_clinic_estoque_lote_normalizar on public.clinic_estoque_lotes;
create trigger trg_clinic_estoque_lote_normalizar
  before insert on public.clinic_estoque_lotes
  for each row execute function public.fn_clinic_estoque_lote_normalizar();

create or replace function public.fn_clinic_estoque_lote(
  p_org uuid, p_product uuid, p_codigo text, p_validade date, p_custo numeric)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg public.clinic_produto_estoque;
  v_codigo text := nullif(upper(btrim(coalesce(p_codigo, ''))), '');
  v_id uuid;
begin
  v_cfg := public.fn_clinic_estoque_config(p_org, p_product);
  if v_cfg.rastreado and (v_codigo is null or p_validade is null) then
    raise exception 'estoque_lote_obrigatorio' using errcode = '22023';
  end if;
  -- compara normalizado: lotes antigos gravados em minúsculas continuam achados
  select l.id into v_id from public.clinic_estoque_lotes l
   where l.organization_id = p_org and l.product_id = p_product
     and upper(btrim(coalesce(l.codigo, ''))) = coalesce(v_codigo, '')
     and coalesce(l.validade, 'infinity'::date) = coalesce(p_validade, 'infinity'::date)
   order by l.created_at, l.id
   limit 1;
  if v_id is null then
    insert into public.clinic_estoque_lotes (organization_id, product_id, codigo, validade, custo_unitario_cents, created_by)
    values (p_org, p_product, v_codigo, p_validade, p_custo, auth.uid())
    on conflict do nothing
    returning id into v_id;
    if v_id is null then
      select l.id into v_id from public.clinic_estoque_lotes l
       where l.organization_id = p_org and l.product_id = p_product
         and coalesce(l.codigo, '') = coalesce(v_codigo, '')
         and coalesce(l.validade, 'infinity'::date) = coalesce(p_validade, 'infinity'::date);
    end if;
  end if;
  return v_id;
end $$;
revoke execute on function public.fn_clinic_estoque_lote(uuid, uuid, text, date, numeric) from public, anon, authenticated;

-- ─── 3. C1: insumo de produto rastreado exige lote e validade ──────────────
create or replace function public.fn_clinic_estoque_insumo_lote_exigido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.product_id is not null
     and (nullif(btrim(coalesce(new.lote, '')), '') is null or new.validade is null)
     and exists (select 1 from public.organizations o
                  where o.id = new.organization_id and (o.settings -> 'clinic' -> 'estoque') = 'true'::jsonb)
     and exists (select 1 from public.clinic_produto_estoque e
                  where e.organization_id = new.organization_id and e.product_id = new.product_id and e.rastreado) then
    raise exception 'insumo_lote_obrigatorio' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_estoque_insumo_lote_exigido() from public, anon, authenticated;
drop trigger if exists trg_clinic_estoque_insumo_lote_exigido on public.clinic_procedimento_insumos;
create trigger trg_clinic_estoque_insumo_lote_exigido
  before insert or update of product_id, lote, validade on public.clinic_procedimento_insumos
  for each row execute function public.fn_clinic_estoque_insumo_lote_exigido();

-- ─── 4. alertas de evento (C4, C6, C8) ─────────────────────────────────────
-- Gravados na hora do fato; a varredura não os resolve sozinha (só quem
-- dispensa, com motivo). Sem dado de paciente no detalhe.
create or replace function public.fn_clinic_estoque_alerta_evento(
  p_org uuid, p_tipo text, p_chave text, p_product uuid, p_lote uuid, p_detalhe jsonb)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.clinic_estoque_alertas (organization_id, tipo, chave, product_id, lote_id, detalhe)
  values (p_org, p_tipo, left(p_chave, 200), p_product, p_lote, coalesce(p_detalhe, '{}'::jsonb))
  on conflict (organization_id, chave) where status = 'aberto' do nothing
$$;
revoke execute on function public.fn_clinic_estoque_alerta_evento(uuid, text, text, uuid, uuid, jsonb) from public, anon, authenticated;

-- A varredura só resolve os tipos que ELA calcula.
create or replace function public.fn_clinic_estoque_varrer_alertas()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_atuais jsonb;
  v_n integer;
  v_abertos integer := 0;
  v_resolvidos integer := 0;
begin
  for v_org in
    select o.id from public.organizations o where (o.settings -> 'clinic' -> 'estoque') = 'true'::jsonb
  loop
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_atuais from public.fn_clinic_estoque_alertas_atuais(v_org) a;

    update public.clinic_estoque_alertas x
       set status = 'resolvido', fechado_em = now(), atualizado_em = now()
     where x.organization_id = v_org and x.status = 'aberto'
       and x.tipo in ('abaixo_minimo', 'ponto_pedido', 'validade_proxima', 'lote_vencido', 'frasco_vencido', 'pendencias_baixa')
       and not exists (select 1 from jsonb_array_elements(v_atuais) a where a ->> 'chave' = x.chave);
    get diagnostics v_n = row_count;
    v_resolvidos := v_resolvidos + v_n;

    update public.clinic_estoque_alertas x
       set detalhe = a -> 'detalhe', atualizado_em = now()
      from jsonb_array_elements(v_atuais) a
     where x.organization_id = v_org and x.status = 'aberto' and x.chave = a ->> 'chave'
       and x.detalhe is distinct from a -> 'detalhe';

    insert into public.clinic_estoque_alertas (organization_id, tipo, chave, product_id, lote_id, frasco_id, detalhe)
    select v_org, a ->> 'tipo', a ->> 'chave', nullif(a ->> 'product_id', '')::uuid, nullif(a ->> 'lote_id', '')::uuid,
           nullif(a ->> 'frasco_id', '')::uuid, coalesce(a -> 'detalhe', '{}'::jsonb)
      from jsonb_array_elements(v_atuais) a
     where not exists (select 1 from public.clinic_estoque_alertas x
                        where x.organization_id = v_org and x.chave = a ->> 'chave'
                          and (x.status = 'aberto' or (x.status = 'dispensado' and x.fechado_em > now() - interval '7 days')));
    get diagnostics v_n = row_count;
    v_abertos := v_abertos + v_n;
  end loop;
  return jsonb_build_object('abertos', v_abertos, 'resolvidos', v_resolvidos);
end $$;
revoke execute on function public.fn_clinic_estoque_varrer_alertas() from public, anon, authenticated;
grant  execute on function public.fn_clinic_estoque_varrer_alertas() to service_role;

-- ─── 5. a saída de um insumo: presumido, bloqueado, vencido ────────────────
-- Versão nova com `p_presumido` (lote escolhido pelo sistema). A de 6
-- argumentos fica e passa a chamar esta: presumido = o insumo não tem lote.
create or replace function public.fn_clinic_estoque_consumir(
  p_org uuid, p_insumo uuid, p_local uuid, p_lotes uuid[], p_qtd numeric, p_ator uuid, p_presumido boolean,
  out operacao_id uuid, out motivo text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ins record;
  v_cfg public.clinic_produto_estoque;
  v_restante numeric := round(p_qtd, 3);
  v_lotes uuid[];
  v_g record;
  v_tira numeric;
  v_frasco uuid;
  v_lacrado numeric;
begin
  select i.id, i.product_id, p.atendimento_id, p.procedure_id,
         coalesce(p.executor_user_id, a.professional_user_id) as profissional, a.contact_id
    into v_ins
    from public.clinic_procedimento_insumos i
    join public.clinic_procedimentos_realizados p on p.id = i.procedimento_id and p.organization_id = p_org
    join public.clinic_atendimentos a on a.id = p.atendimento_id and a.organization_id = p_org
   where i.id = p_insumo and i.organization_id = p_org;
  if v_ins.id is null then
    raise exception 'estoque_insumo_invalido' using errcode = 'P0002';
  end if;
  if p_local is null then
    motivo := 'sem_local';
    return;
  end if;
  -- lote escolhido pelo sistema nunca é um lote bloqueado
  select array_agg(l.id) into v_lotes from public.clinic_estoque_lotes l
   where l.organization_id = p_org and l.id = any(coalesce(p_lotes, '{}'))
     and (not coalesce(p_presumido, false) or l.bloqueado_em is null);
  if cardinality(coalesce(v_lotes, '{}')) = 0 then
    motivo := 'sem_saldo';
    return;
  end if;
  select * into v_cfg from public.clinic_produto_estoque e
   where e.organization_id = p_org and e.product_id = v_ins.product_id;

  perform public.fn_clinic_estoque_travar(p_org, v_lotes);
  insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, origem_id, ator)
  values (p_org, 'consumo', 'insumo', p_insumo, p_ator)
  returning id into operacao_id;

  -- 1) frascos abertos no prazo
  for v_g in
    select f.id as frasco_id, f.lote_id, l.custo_unitario_cents,
           (select coalesce(sum(m.quantidade), 0) from public.clinic_estoque_movimentos m
             where m.organization_id = p_org and m.frasco_id = f.id) as saldo
      from public.clinic_estoque_frascos f
      join public.clinic_estoque_lotes l on l.id = f.lote_id
     where f.organization_id = p_org and f.status = 'aberto' and f.local_id = p_local
       and f.lote_id = any(v_lotes) and f.product_id = v_ins.product_id
       and (f.vence_em is null or f.vence_em > now())
     order by f.vence_em nulls last, f.aberto_em, f.id
  loop
    exit when v_restante <= 0;
    continue when v_g.saldo <= 0;
    v_tira := least(v_g.saldo, v_restante);
    insert into public.clinic_estoque_movimentos
      (organization_id, operacao_id, product_id, lote_id, local_id, frasco_id, quantidade, custo_unitario_cents,
       atendimento_id, contact_id, profissional_user_id, procedure_id, lote_presumido)
    values (p_org, operacao_id, v_ins.product_id, v_g.lote_id, p_local, v_g.frasco_id, -v_tira, v_g.custo_unitario_cents,
            v_ins.atendimento_id, v_ins.contact_id, v_ins.profissional, v_ins.procedure_id, coalesce(p_presumido, false));
    v_restante := v_restante - v_tira;
  end loop;

  -- 2) lacrado, por FEFO do lote
  for v_g in
    select l.id as lote_id, l.custo_unitario_cents, (l.validade is not null and l.validade < current_date) as vencido
      from public.clinic_estoque_lotes l
     where l.organization_id = p_org and l.id = any(v_lotes) and l.product_id = v_ins.product_id
     order by l.validade nulls last, l.created_at, l.id
  loop
    exit when v_restante <= 0;
    loop
      exit when v_restante <= 0;
      select coalesce(sum(m.quantidade), 0) into v_lacrado from public.clinic_estoque_movimentos m
       where m.organization_id = p_org and m.lote_id = v_g.lote_id and m.local_id = p_local and m.frasco_id is null;
      exit when v_lacrado <= 0;
      if coalesce(v_cfg.fracionavel, false) and not v_g.vencido and v_lacrado >= v_cfg.fator_conversao then
        v_frasco := public.fn_clinic_estoque_frasco_abrir_interno(p_org, v_g.lote_id, p_local, p_ator);
        v_tira := least(v_cfg.fator_conversao, v_restante);
      else
        v_frasco := null;
        v_tira := least(v_lacrado, v_restante);
      end if;
      insert into public.clinic_estoque_movimentos
        (organization_id, operacao_id, product_id, lote_id, local_id, frasco_id, quantidade, custo_unitario_cents,
         atendimento_id, contact_id, profissional_user_id, procedure_id, lote_presumido)
      values (p_org, operacao_id, v_ins.product_id, v_g.lote_id, p_local, v_frasco, -v_tira, v_g.custo_unitario_cents,
              v_ins.atendimento_id, v_ins.contact_id, v_ins.profissional, v_ins.procedure_id, coalesce(p_presumido, false));
      v_restante := v_restante - v_tira;
    end loop;
  end loop;

  if v_restante > 0 then
    raise exception 'estoque_insuficiente' using errcode = '23514';
  end if;
  perform public.fn_clinic_estoque_conferir_saldos(p_org, operacao_id);

  -- C4 / C8: aplicou lote vencido ou bloqueado → alerta (sem paciente no detalhe)
  perform public.fn_clinic_estoque_alerta_evento(
            p_org,
            case when l.validade is not null and l.validade < current_date then 'consumo_lote_vencido'
                 else 'lote_bloqueado_consumido' end,
            case when l.validade is not null and l.validade < current_date then 'consumo_lote_vencido:'
                 else 'lote_bloqueado_consumido:' end || operacao_id || ':' || l.id,
            l.product_id, l.id,
            jsonb_build_object('validade', l.validade, 'operacao_id', operacao_id))
     from public.clinic_estoque_lotes l
    where l.organization_id = p_org
      and l.id in (select distinct m.lote_id from public.clinic_estoque_movimentos m
                    where m.organization_id = p_org and m.operacao_id = fn_clinic_estoque_consumir.operacao_id)
      and ((l.validade is not null and l.validade < current_date) or l.bloqueado_em is not null);

  update public.clinic_procedimento_insumos set movimento_estoque_id = operacao_id
   where id = p_insumo and organization_id = p_org;
end $$;
revoke execute on function public.fn_clinic_estoque_consumir(uuid, uuid, uuid, uuid[], numeric, uuid, boolean) from public, anon, authenticated;

create or replace function public.fn_clinic_estoque_consumir(
  p_org uuid, p_insumo uuid, p_local uuid, p_lotes uuid[], p_qtd numeric, p_ator uuid,
  out operacao_id uuid, out motivo text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_r record;
begin
  select * into v_r from public.fn_clinic_estoque_consumir(
    p_org, p_insumo, p_local, p_lotes, p_qtd, p_ator,
    not exists (select 1 from public.clinic_procedimento_insumos i
                 where i.id = p_insumo and i.organization_id = p_org and nullif(btrim(coalesce(i.lote, '')), '') is not null));
  operacao_id := v_r.operacao_id;
  motivo := v_r.motivo;
end $$;
revoke execute on function public.fn_clinic_estoque_consumir(uuid, uuid, uuid, uuid[], numeric, uuid) from public, anon, authenticated;

-- ─── 6. a baixa do procedimento: lote normalizado, sem bloqueado, conselho ──
create or replace function public.fn_clinic_estoque_baixar_procedimento(p_org uuid, p_procedimento uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proc record;
  v_local uuid;
  v_conselho text;
  v_i record;
  v_cfg public.clinic_produto_estoque;
  v_qtd numeric;
  v_lotes uuid[];
  v_r record;
  v_op uuid;
  v_nao_habilitado boolean;
  v_baixados integer := 0;
  v_pendencias integer := 0;
  v_livres integer := 0;
begin
  if not coalesce((select (o.settings -> 'clinic' -> 'estoque') = 'true'::jsonb
                     from public.organizations o where o.id = p_org), false) then
    return jsonb_build_object('ligado', false);
  end if;
  select p.id, p.atendimento_id, p.status, coalesce(p.executor_user_id, a.professional_user_id) as profissional
    into v_proc
    from public.clinic_procedimentos_realizados p
    join public.clinic_atendimentos a on a.id = p.atendimento_id and a.organization_id = p_org
   where p.id = p_procedimento and p.organization_id = p_org;
  if v_proc.id is null or v_proc.status <> 'finalizado' then
    raise exception 'estoque_procedimento_invalido' using errcode = 'P0002';
  end if;

  v_local := public.fn_clinic_estoque_local_do_atendimento(p_org, v_proc.atendimento_id);
  select cp.council into v_conselho from public.clinic_professionals cp
   where cp.organization_id = p_org and cp.user_id = v_proc.profissional;

  for v_i in
    select i.id, i.product_id, i.quantidade, i.unidade, nullif(upper(btrim(coalesce(i.lote, ''))), '') as lote, i.validade,
           i.movimento_estoque_id
      from public.clinic_procedimento_insumos i
     where i.organization_id = p_org and i.procedimento_id = p_procedimento and i.product_id is not null
     order by i.created_at, i.id
  loop
    select * into v_cfg from public.clinic_produto_estoque e
     where e.organization_id = p_org and e.product_id = v_i.product_id;
    if v_cfg.id is null then
      v_livres := v_livres + 1;
      continue;
    end if;
    v_qtd := public.fn_clinic_estoque_qtd_aplicacao(v_cfg, v_i.quantidade, v_i.unidade);
    v_op := null;
    -- C5: a habilitação é avaliada ANTES de saber se a baixa sai
    v_nao_habilitado := v_cfg.controlado and (v_conselho is null or not (v_conselho = any(v_cfg.conselhos_permitidos)));

    select o.id into v_op from public.clinic_estoque_operacoes o
     where o.organization_id = p_org and o.origem_tipo = 'insumo' and o.origem_id = v_i.id and o.tipo <> 'estorno';
    if v_op is null then
      v_lotes := null;
      if v_i.lote is not null then
        select array_agg(l.id) into v_lotes from public.clinic_estoque_lotes l
         where l.organization_id = p_org and l.product_id = v_i.product_id
           and upper(btrim(coalesce(l.codigo, ''))) = v_i.lote
           and (v_i.validade is null or l.validade = v_i.validade);
        if v_lotes is null then
          insert into public.clinic_estoque_pendencias
            (organization_id, insumo_id, atendimento_id, product_id, quantidade, lote_informado, motivo)
          values (p_org, v_i.id, v_proc.atendimento_id, v_i.product_id, v_qtd, v_i.lote, 'lote_desconhecido')
          on conflict (insumo_id, motivo) do nothing;
          v_pendencias := v_pendencias + 1;
        end if;
      else
        select array_agg(l.id) into v_lotes from public.clinic_estoque_lotes l
         where l.organization_id = p_org and l.product_id = v_i.product_id
           and (l.validade is null or l.validade >= current_date)
           and l.bloqueado_em is null;
      end if;

      if v_lotes is not null or v_i.lote is null then
        begin
          select * into v_r from public.fn_clinic_estoque_consumir(
            p_org, v_i.id, v_local, coalesce(v_lotes, '{}'), v_qtd, v_proc.profissional, v_i.lote is null);
        exception
          when sqlstate '23514' then
            select null::uuid as operacao_id, 'sem_saldo'::text as motivo into v_r;
          when unique_violation then
            select o.id as operacao_id, null::text as motivo into v_r from public.clinic_estoque_operacoes o
             where o.organization_id = p_org and o.origem_tipo = 'insumo' and o.origem_id = v_i.id and o.tipo <> 'estorno';
        end;
        if v_r.operacao_id is null then
          insert into public.clinic_estoque_pendencias
            (organization_id, insumo_id, atendimento_id, product_id, quantidade, lote_informado, motivo)
          values (p_org, v_i.id, v_proc.atendimento_id, v_i.product_id, v_qtd, v_i.lote, v_r.motivo)
          on conflict (insumo_id, motivo) do nothing;
          v_pendencias := v_pendencias + 1;
        else
          v_op := v_r.operacao_id;
        end if;
      end if;
    elsif v_i.movimento_estoque_id is distinct from v_op then
      update public.clinic_procedimento_insumos set movimento_estoque_id = v_op
       where id = v_i.id and organization_id = p_org;
    end if;
    if v_op is not null then
      v_baixados := v_baixados + 1;
    end if;

    if v_nao_habilitado then
      insert into public.clinic_estoque_pendencias
        (organization_id, insumo_id, atendimento_id, product_id, quantidade, lote_informado, motivo, operacao_id)
      values (p_org, v_i.id, v_proc.atendimento_id, v_i.product_id, v_qtd, v_i.lote, 'profissional_nao_habilitado', v_op)
      on conflict (insumo_id, motivo) do nothing;
      v_pendencias := v_pendencias + 1;
    end if;
  end loop;

  return jsonb_build_object('ligado', true, 'baixados', v_baixados, 'pendencias', v_pendencias, 'livres', v_livres);
end $$;
revoke execute on function public.fn_clinic_estoque_baixar_procedimento(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.fn_clinic_estoque_baixar_procedimento(uuid, uuid) to service_role;

-- ─── 7. resolver pendência: lote escolhido por gente, conselho conferido ───
create or replace function public.fn_clinic_estoque_pendencia_resolver(p_org uuid, p_pendencia uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p public.clinic_estoque_pendencias;
  v_acao text := p_dados ->> 'acao';
  v_motivo text := nullif(btrim(coalesce(p_dados ->> 'motivo', '')), '');
  v_lote uuid := nullif(p_dados ->> 'lote_id', '')::uuid;
  v_local uuid := nullif(p_dados ->> 'local_id', '')::uuid;
  v_r record;
  v_cfg public.clinic_produto_estoque;
  v_conselho text;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.movimentar');
  select * into v_p from public.clinic_estoque_pendencias p
   where p.id = p_pendencia and p.organization_id = p_org
   for update;
  if v_p.id is null then
    raise exception 'estoque_pendencia_invalida' using errcode = 'P0002';
  end if;
  if v_p.status <> 'aberta' then
    raise exception 'estoque_pendencia_fechada' using errcode = '22023';
  end if;

  if v_acao = 'baixar' then
    if v_p.motivo = 'profissional_nao_habilitado' then
      raise exception 'estoque_dados_invalidos' using errcode = '22023';
    end if;
    if public.fn_clinic_estoque_lote_da_org(p_org, v_lote) <> v_p.product_id then
      raise exception 'estoque_lote_invalido' using errcode = '22023';
    end if;
    perform public.fn_clinic_estoque_local_valido(p_org, v_local);
    if exists (select 1 from public.clinic_estoque_operacoes o
                where o.organization_id = p_org and o.origem_tipo = 'insumo' and o.origem_id = v_p.insumo_id
                  and o.tipo <> 'estorno') then
      raise exception 'estoque_ja_baixado' using errcode = '23505';
    end if;
    -- lote escolhido por gente: não é presumido (vencido/bloqueado geram alerta)
    select * into v_r from public.fn_clinic_estoque_consumir(
      p_org, v_p.insumo_id, v_local, array[v_lote], v_p.quantidade, auth.uid(), false);
    update public.clinic_estoque_pendencias
       set status = 'resolvida', operacao_id = v_r.operacao_id, resolvida_por = auth.uid(), resolvida_em = now()
     where id = v_p.id;
    -- C5: o conselho de quem aplicou também vale aqui
    select * into v_cfg from public.clinic_produto_estoque e where e.organization_id = p_org and e.product_id = v_p.product_id;
    select cp.council into v_conselho
      from public.clinic_atendimentos a
      join public.clinic_procedimento_insumos i on i.id = v_p.insumo_id and i.organization_id = p_org
      join public.clinic_procedimentos_realizados pr on pr.id = i.procedimento_id and pr.organization_id = p_org
      left join public.clinic_professionals cp
        on cp.organization_id = p_org and cp.user_id = coalesce(pr.executor_user_id, a.professional_user_id)
     where a.id = v_p.atendimento_id and a.organization_id = p_org;
    if coalesce(v_cfg.controlado, false)
       and (v_conselho is null or not (v_conselho = any(v_cfg.conselhos_permitidos))) then
      insert into public.clinic_estoque_pendencias
        (organization_id, insumo_id, atendimento_id, product_id, quantidade, lote_informado, motivo, operacao_id)
      values (p_org, v_p.insumo_id, v_p.atendimento_id, v_p.product_id, v_p.quantidade, v_p.lote_informado,
              'profissional_nao_habilitado', v_r.operacao_id)
      on conflict (insumo_id, motivo) do nothing;
    end if;
    return jsonb_build_object('status', 'resolvida', 'operacao_id', v_r.operacao_id);
  elsif v_acao in ('descartar', 'ciente') then
    if v_motivo is null or char_length(v_motivo) < 3 then
      raise exception 'estoque_sem_motivo' using errcode = '22023';
    end if;
    if (v_acao = 'ciente') <> (v_p.motivo = 'profissional_nao_habilitado') then
      raise exception 'estoque_dados_invalidos' using errcode = '22023';
    end if;
    update public.clinic_estoque_pendencias
       set status = case when v_acao = 'ciente' then 'resolvida' else 'descartada' end,
           resolucao = left(v_motivo, 300), resolvida_por = auth.uid(), resolvida_em = now()
     where id = v_p.id;
    return jsonb_build_object('status', case when v_acao = 'ciente' then 'resolvida' else 'descartada' end);
  end if;
  raise exception 'estoque_dados_invalidos' using errcode = '22023';
end $$;
revoke execute on function public.fn_clinic_estoque_pendencia_resolver(uuid, uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_pendencia_resolver(uuid, uuid, jsonb) to authenticated;

-- ─── 8. C8: bloquear / desbloquear um lote ─────────────────────────────────
create or replace function public.fn_clinic_estoque_lote_bloquear(p_org uuid, p_lote uuid, p_bloquear boolean, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.configurar');
  perform public.fn_clinic_estoque_lote_da_org(p_org, p_lote);
  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception 'estoque_sem_motivo' using errcode = '22023';
  end if;
  update public.clinic_estoque_lotes
     set bloqueado_em = case when p_bloquear then coalesce(bloqueado_em, now()) end,
         bloqueado_por = case when p_bloquear then auth.uid() end,
         bloqueio_motivo = case when p_bloquear then left(v_motivo, 300) end
   where id = p_lote and organization_id = p_org;
  return jsonb_build_object('bloqueado', coalesce(p_bloquear, false));
end $$;
revoke execute on function public.fn_clinic_estoque_lote_bloquear(uuid, uuid, boolean, text) from public, anon;
grant  execute on function public.fn_clinic_estoque_lote_bloquear(uuid, uuid, boolean, text) to authenticated;

-- Saída manual (perda é permitida: é o descarte do lote recolhido); a
-- transferência de lote bloqueado também (levar para a quarentena).

-- ─── 9. C10: perda com categoria ───────────────────────────────────────────
create or replace function public.fn_clinic_estoque_perda(p_org uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote uuid := nullif(p_dados ->> 'lote_id', '')::uuid;
  v_local uuid := nullif(p_dados ->> 'local_id', '')::uuid;
  v_qtd numeric := (p_dados ->> 'quantidade')::numeric;
  v_motivo text := nullif(btrim(coalesce(p_dados ->> 'motivo', '')), '');
  v_categoria text := coalesce(nullif(p_dados ->> 'categoria', ''), 'outro');
  v_product uuid;
  v_op uuid;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.movimentar');
  v_product := public.fn_clinic_estoque_lote_da_org(p_org, v_lote);
  perform public.fn_clinic_estoque_local_valido(p_org, v_local);
  if v_qtd is null or v_qtd <= 0 then
    raise exception 'estoque_quantidade_invalida' using errcode = '22023';
  end if;
  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception 'estoque_sem_motivo' using errcode = '22023';
  end if;
  if v_categoria not in ('vencimento', 'quebra', 'contaminacao', 'pos_abertura', 'recolhimento', 'outro') then
    raise exception 'estoque_dados_invalidos' using errcode = '22023';
  end if;
  perform public.fn_clinic_estoque_travar(p_org, array[v_lote]);
  insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, motivo, motivo_categoria, ator)
  values (p_org, 'perda', 'manual', left(v_motivo, 300), v_categoria, auth.uid())
  returning id into v_op;
  insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, quantidade)
  values (p_org, v_op, v_product, v_lote, v_local, -round(v_qtd, 3));
  perform public.fn_clinic_estoque_conferir_saldos(p_org, v_op);
  return jsonb_build_object('operacao_id', v_op);
end $$;
revoke execute on function public.fn_clinic_estoque_perda(uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_perda(uuid, jsonb) to authenticated;

-- A perda que nasce de outros caminhos (encerrar frasco) ganha categoria sozinha.
create or replace function public.fn_clinic_estoque_operacao_categoria()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'perda' and new.motivo_categoria is null then
    new.motivo_categoria := case when new.origem_tipo = 'frasco' then 'pos_abertura' else 'outro' end;
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_estoque_operacao_categoria() from public, anon, authenticated;
drop trigger if exists trg_clinic_estoque_operacao_categoria on public.clinic_estoque_operacoes;
create trigger trg_clinic_estoque_operacao_categoria
  before insert on public.clinic_estoque_operacoes
  for each row execute function public.fn_clinic_estoque_operacao_categoria();

create or replace function public.fn_clinic_estoque_rel_perdas(p_org uuid, p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_custos boolean;
begin
  if not public.fn_clinic_estoque_pode(p_org, 'estoque.ver') then
    raise exception 'acesso_proibido' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 400 then
    raise exception 'estoque_dados_invalidos' using errcode = '22023';
  end if;
  v_custos := public.fn_has_permission(p_org, 'estoque.custos');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', x.product_id, 'produto', c.nome, 'unidade', coalesce(e.unidade_aplicacao, 'un'),
             'categoria', x.categoria, 'motivo', x.motivo, 'quantidade', x.quantidade, 'ocorrencias', x.ocorrencias,
             'custo_cents', case when v_custos then x.custo end)
           order by x.quantidade desc)
      from (
        select m.product_id,
               coalesce(o.motivo_categoria,
                        case when o.origem_tipo = 'frasco' then 'pos_abertura'
                             when o.motivo ilike '%venc%' then 'vencimento' else 'outro' end) as categoria,
               case coalesce(o.motivo_categoria,
                             case when o.origem_tipo = 'frasco' then 'pos_abertura'
                                  when o.motivo ilike '%venc%' then 'vencimento' else 'outro' end)
                 when 'vencimento' then 'Vencimento'
                 when 'quebra' then 'Quebra'
                 when 'contaminacao' then 'Contaminação'
                 when 'pos_abertura' then 'Prazo após aberto'
                 when 'recolhimento' then 'Recolhimento (recall)'
                 else 'Outro' end as motivo,
               -sum(m.quantidade) as quantidade,
               count(distinct o.id) as ocorrencias,
               round(-sum(m.quantidade * coalesce(m.custo_unitario_cents, 0))) as custo
          from public.clinic_estoque_operacoes o
          join public.clinic_estoque_movimentos m on m.organization_id = o.organization_id and m.operacao_id = o.id
         where o.organization_id = p_org and o.tipo = 'perda'
           and o.created_at >= p_de and o.created_at < p_ate + 1
           and not exists (select 1 from public.clinic_estoque_operacoes e2
                            where e2.organization_id = p_org and e2.estorna_operacao_id = o.id)
         group by 1, 2, 3
        having sum(m.quantidade) <> 0
      ) x
      join public.catalog_products c on c.id = x.product_id
      left join public.clinic_produto_estoque e on e.organization_id = p_org and e.product_id = x.product_id
  ), '[]'::jsonb);
end $$;
revoke execute on function public.fn_clinic_estoque_rel_perdas(uuid, date, date) from public, anon;
grant  execute on function public.fn_clinic_estoque_rel_perdas(uuid, date, date) to authenticated;

-- ─── 10. C9: estorno não devolve conteúdo a frasco encerrado ou vencido ─────
create or replace function public.fn_clinic_estoque_estornar(p_org uuid, p_operacao uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo text;
  v_op uuid;
  v_lotes uuid[];
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.estornar');
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'estoque_sem_motivo' using errcode = '22023';
  end if;
  select o.tipo into v_tipo from public.clinic_estoque_operacoes o where o.id = p_operacao and o.organization_id = p_org;
  if v_tipo is null then
    raise exception 'estoque_operacao_invalida' using errcode = 'P0002';
  end if;
  if v_tipo = 'estorno' then
    raise exception 'estoque_estorno_de_estorno' using errcode = '22023';
  end if;
  if exists (select 1 from public.clinic_estoque_operacoes o
              where o.organization_id = p_org and o.estorna_operacao_id = p_operacao) then
    raise exception 'estoque_ja_estornada' using errcode = '23505';
  end if;
  if exists (select 1 from public.clinic_estoque_movimentos m
               join public.clinic_estoque_frascos f on f.id = m.frasco_id and f.organization_id = p_org
              where m.organization_id = p_org and m.operacao_id = p_operacao
                and m.quantidade < 0
                and (f.status <> 'aberto' or (f.vence_em is not null and f.vence_em <= now()))) then
    raise exception 'estoque_frasco_encerrado' using errcode = '22023';
  end if;
  select array_agg(distinct m.lote_id) into v_lotes from public.clinic_estoque_movimentos m
   where m.organization_id = p_org and m.operacao_id = p_operacao;
  perform public.fn_clinic_estoque_travar(p_org, coalesce(v_lotes, '{}'));
  insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, estorna_operacao_id, motivo, ator)
  values (p_org, 'estorno', 'estorno', p_operacao, left(btrim(p_motivo), 300), auth.uid())
  returning id into v_op;
  insert into public.clinic_estoque_movimentos
    (organization_id, operacao_id, product_id, lote_id, local_id, frasco_id, quantidade, custo_unitario_cents,
     atendimento_id, contact_id, profissional_user_id, procedure_id, lote_presumido)
  select m.organization_id, v_op, m.product_id, m.lote_id, m.local_id, m.frasco_id, -m.quantidade, m.custo_unitario_cents,
         m.atendimento_id, m.contact_id, m.profissional_user_id, m.procedure_id, m.lote_presumido
    from public.clinic_estoque_movimentos m
   where m.organization_id = p_org and m.operacao_id = p_operacao;
  perform public.fn_clinic_estoque_conferir_saldos(p_org, v_op);
  return jsonb_build_object('operacao_id', v_op);
end $$;
revoke execute on function public.fn_clinic_estoque_estornar(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_estoque_estornar(uuid, uuid, text) to authenticated;

-- ─── 11. NF-e: XML no Storage (S4), lote exigido com rastro (C3), vários
--          lotes por item (C3), registro e fabricação no lote (C6) ─────────────
create or replace function public.fn_clinic_estoque_nfe_registrar(p_org uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chave text := p_dados ->> 'chave';
  v_cnpj text := nullif(p_dados -> 'emitente' ->> 'cnpj', '');
  v_nome text := left(coalesce(nullif(btrim(p_dados -> 'emitente' ->> 'nome'), ''), 'Fornecedor'), 200);
  v_path text := p_dados ->> 'arquivo_path';
  v_fornecedor uuid;
  v_id uuid;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.compras');
  if v_chave is null or v_chave !~ '^[0-9]{44}$' or jsonb_typeof(p_dados -> 'itens') <> 'array'
     or jsonb_array_length(p_dados -> 'itens') = 0 or jsonb_array_length(p_dados -> 'itens') > 990 then
    raise exception 'estoque_dados_invalidos' using errcode = '22023';
  end if;
  -- S4: a nota só existe com o XML guardado no bucket da clínica
  if v_path is null or v_path not like p_org::text || '/%'
     or not exists (select 1 from storage.objects s where s.bucket_id = 'clinic-nfe' and s.name = v_path) then
    raise exception 'estoque_nfe_sem_arquivo' using errcode = '22023';
  end if;
  if exists (select 1 from public.clinic_estoque_nfe n where n.organization_id = p_org and n.chave = v_chave) then
    raise exception 'estoque_nfe_duplicada' using errcode = '23505';
  end if;
  if v_cnpj ~ '^[0-9]{14}$' then
    insert into public.clinic_estoque_fornecedores (organization_id, cnpj, nome)
    values (p_org, v_cnpj, v_nome)
    on conflict (organization_id, cnpj) do update set nome = excluded.nome
    returning id into v_fornecedor;
  end if;

  insert into public.clinic_estoque_nfe
    (organization_id, chave, numero, serie, emissao, fornecedor_id, emitente_cnpj, emitente_nome,
     destinatario_cnpj, total_cents, arquivo_path, sha256, created_by)
  values (p_org, v_chave, left(coalesce(p_dados ->> 'numero', ''), 20), left(coalesce(p_dados ->> 'serie', ''), 10),
          (p_dados ->> 'emissao')::date, v_fornecedor, v_cnpj, v_nome, nullif(p_dados ->> 'destinatario_cnpj', ''),
          coalesce((p_dados ->> 'total_cents')::bigint, 0), v_path, p_dados ->> 'sha256', auth.uid())
  returning id into v_id;

  insert into public.clinic_estoque_nfe_itens
    (organization_id, nfe_id, numero, codigo, descricao, ean, ncm, unidade, quantidade, valor_total_cents,
     custo_total_cents, registro_anvisa, rastro, product_id, origem_casamento, fator, lote, validade)
  select p_org, v_id, (i ->> 'numero')::integer, left(coalesce(i ->> 'codigo', ''), 60), left(coalesce(i ->> 'descricao', ''), 200),
         nullif(i ->> 'ean', ''), nullif(i ->> 'ncm', ''), left(coalesce(nullif(i ->> 'unidade', ''), 'un'), 20),
         (i ->> 'quantidade')::numeric, coalesce((i ->> 'valor_total_cents')::bigint, 0),
         coalesce((i ->> 'custo_total_cents')::bigint, 0), left(nullif(i ->> 'registro_anvisa', ''), 40),
         coalesce(i -> 'rastro', '[]'::jsonb),
         c.id,
         case when c.id is not null then i ->> 'origem_casamento' end,
         nullif(i ->> 'fator', '')::numeric,
         left(nullif(upper(btrim(coalesce(i ->> 'lote', ''))), ''), 60),
         nullif(i ->> 'validade', '')::date
    from jsonb_array_elements(p_dados -> 'itens') i
    left join public.catalog_products c
      on c.id = nullif(i ->> 'product_id', '')::uuid and c.organization_id = p_org;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.fn_clinic_estoque_nfe_registrar(uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_nfe_registrar(uuid, jsonb) to authenticated;

create or replace function public.fn_clinic_estoque_nfe_item_conferir(p_org uuid, p_item uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.clinic_estoque_nfe_itens;
  v_status text;
  v_product uuid := nullif(p_dados ->> 'product_id', '')::uuid;
  v_fator numeric := coalesce(nullif(p_dados ->> 'fator', '')::numeric, 1);
  v_lote text := left(nullif(upper(btrim(coalesce(p_dados ->> 'lote', ''))), ''), 60);
  v_validade date := nullif(p_dados ->> 'validade', '')::date;
  v_rastreado boolean;
  v_varios boolean;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.compras');
  select * into v_item from public.clinic_estoque_nfe_itens i where i.id = p_item and i.organization_id = p_org for update;
  if v_item.id is null then
    raise exception 'estoque_nfe_invalida' using errcode = 'P0002';
  end if;
  select n.status into v_status from public.clinic_estoque_nfe n where n.id = v_item.nfe_id for update;
  if v_status <> 'conferencia' then
    raise exception 'estoque_nfe_fechada' using errcode = '22023';
  end if;

  if coalesce((p_dados ->> 'ignorar')::boolean, false) then
    update public.clinic_estoque_nfe_itens
       set ignorado = true, conferido = true, product_id = null, origem_casamento = null, fator = null, lote = null, validade = null
     where id = p_item;
    return jsonb_build_object('conferido', true, 'ignorado', true);
  end if;

  if v_product is null or not exists (select 1 from public.catalog_products c where c.id = v_product and c.organization_id = p_org) then
    raise exception 'estoque_produto_invalido' using errcode = '22023';
  end if;
  if v_fator <= 0 then
    raise exception 'estoque_quantidade_invalida' using errcode = '22023';
  end if;
  -- vários lotes no XML: os lotes vêm do `rastro` (lançados um a um)
  v_varios := jsonb_array_length(v_item.rastro) > 1;
  if v_varios then
    v_lote := null;
    v_validade := null;
  else
    select coalesce(e.rastreado, false) into v_rastreado from public.clinic_produto_estoque e
     where e.organization_id = p_org and e.product_id = v_product;
    -- produto rastreado, item com rastro ou com registro ANVISA: lote e validade
    if (coalesce(v_rastreado, false) or jsonb_array_length(v_item.rastro) = 1 or v_item.registro_anvisa is not null)
       and (v_lote is null or v_validade is null) then
      raise exception 'estoque_lote_obrigatorio' using errcode = '22023';
    end if;
    if v_validade is not null and v_validade < current_date then
      raise exception 'estoque_lote_vencido' using errcode = '22023';
    end if;
  end if;

  update public.clinic_estoque_nfe_itens
     set product_id = v_product,
         origem_casamento = case when v_item.product_id = v_product then coalesce(v_item.origem_casamento, 'manual') else 'manual' end,
         fator = v_fator, lote = v_lote, validade = v_validade, ignorado = false, conferido = true
   where id = p_item;
  return jsonb_build_object('conferido', true, 'ignorado', false);
end $$;
revoke execute on function public.fn_clinic_estoque_nfe_item_conferir(uuid, uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_nfe_item_conferir(uuid, uuid, jsonb) to authenticated;

create or replace function public.fn_clinic_estoque_nfe_lancar(p_org uuid, p_nfe uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nfe public.clinic_estoque_nfe;
  v_local uuid := nullif(p_dados ->> 'local_id', '')::uuid;
  v_conta uuid := nullif(p_dados ->> 'conta_id', '')::uuid;
  v_i public.clinic_estoque_nfe_itens;
  v_r jsonb;
  v_partes jsonb;
  v_p jsonb;
  v_qtd numeric;
  v_custo numeric;
  v_lote uuid;
  v_op uuid;
  v_registro text;
  v_entradas integer := 0;
  v_fin uuid;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.compras');
  select * into v_nfe from public.clinic_estoque_nfe n where n.id = p_nfe and n.organization_id = p_org for update;
  if v_nfe.id is null then
    raise exception 'estoque_nfe_invalida' using errcode = 'P0002';
  end if;
  if v_nfe.status <> 'conferencia' then
    raise exception 'estoque_nfe_fechada' using errcode = '22023';
  end if;
  perform public.fn_clinic_estoque_local_valido(p_org, v_local);
  if exists (select 1 from public.clinic_estoque_nfe_itens i where i.nfe_id = p_nfe and not i.conferido) then
    raise exception 'estoque_nfe_sem_conferencia' using errcode = '22023';
  end if;
  if v_conta is not null then
    if not public.fn_has_permission(p_org, 'financeiro.lancar') then
      raise exception 'acesso_proibido' using errcode = '42501';
    end if;
    if not exists (select 1 from public.financial_accounts a where a.id = v_conta and a.organization_id = p_org) then
      raise exception 'estoque_conta_invalida' using errcode = '22023';
    end if;
  end if;

  for v_i in
    select * from public.clinic_estoque_nfe_itens i
     where i.nfe_id = p_nfe and not i.ignorado and i.product_id is not null
     order by i.numero
  loop
    v_qtd := round(v_i.quantidade * coalesce(v_i.fator, 1), 3);
    v_custo := case when v_qtd > 0 then round(v_i.custo_total_cents::numeric / v_qtd, 4) end;
    -- as partes do item: um lote por `rastro` (vários) ou o lote conferido
    if jsonb_array_length(v_i.rastro) > 1 then
      if abs(coalesce((select sum((r ->> 'quantidade')::numeric) from jsonb_array_elements(v_i.rastro) r), -1)
             - v_i.quantidade) > 0.001 then
        raise exception 'estoque_nfe_rastro_divergente' using errcode = '22023';
      end if;
      v_partes := v_i.rastro;
    else
      v_partes := jsonb_build_array(jsonb_build_object(
        'lote', v_i.lote, 'validade', v_i.validade, 'quantidade', v_i.quantidade,
        'fabricacao', case when jsonb_array_length(v_i.rastro) = 1
                            and upper(btrim(coalesce(v_i.rastro -> 0 ->> 'lote', ''))) = coalesce(v_i.lote, '')
                           then v_i.rastro -> 0 ->> 'fabricacao' end));
    end if;

    insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, origem_id, motivo, ator)
    values (p_org, 'entrada', 'nfe_item', v_i.id, left('NF-e ' || v_nfe.numero || ' — ' || v_nfe.emitente_nome, 300), auth.uid())
    returning id into v_op;
    for v_p in select * from jsonb_array_elements(v_partes)
    loop
      if nullif(v_p ->> 'validade', '')::date < current_date then
        raise exception 'estoque_lote_vencido' using errcode = '22023';
      end if;
      v_lote := public.fn_clinic_estoque_lote(p_org, v_i.product_id, v_p ->> 'lote',
                                              nullif(v_p ->> 'validade', '')::date, v_custo);
      update public.clinic_estoque_lotes l
         set fornecedor_id = coalesce(l.fornecedor_id, v_nfe.fornecedor_id),
             nfe_item_id = coalesce(l.nfe_item_id, v_i.id),
             custo_unitario_cents = coalesce(l.custo_unitario_cents, v_custo),
             registro_anvisa = coalesce(l.registro_anvisa, v_i.registro_anvisa),
             fabricacao = coalesce(l.fabricacao, nullif(v_p ->> 'fabricacao', '')::date)
       where l.id = v_lote;
      insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, quantidade, custo_unitario_cents)
      values (p_org, v_op, v_i.product_id, v_lote, v_local,
              round((v_p ->> 'quantidade')::numeric * coalesce(v_i.fator, 1), 3), v_custo);
    end loop;
    update public.clinic_estoque_nfe_itens set operacao_id = v_op where id = v_i.id;

    -- C6: registro da nota diferente do cadastro do produto → alerta
    select e.registro_anvisa into v_registro from public.clinic_produto_estoque e
     where e.organization_id = p_org and e.product_id = v_i.product_id;
    if v_i.registro_anvisa is not null and v_registro is not null
       and regexp_replace(v_i.registro_anvisa, '\D', '', 'g') <> regexp_replace(v_registro, '\D', '', 'g') then
      perform public.fn_clinic_estoque_alerta_evento(
        p_org, 'nfe_registro_divergente', 'nfe_registro_divergente:' || v_i.id, v_i.product_id, null,
        jsonb_build_object('registro_nfe', v_i.registro_anvisa, 'registro_cadastro', v_registro, 'nfe_id', p_nfe));
    end if;

    if v_nfe.fornecedor_id is not null then
      insert into public.clinic_estoque_fornecedor_produtos (organization_id, fornecedor_id, codigo, product_id, fator)
      values (p_org, v_nfe.fornecedor_id, v_i.codigo, v_i.product_id, coalesce(v_i.fator, 1))
      on conflict (organization_id, fornecedor_id, codigo)
      do update set product_id = excluded.product_id, fator = excluded.fator, updated_at = now();
    end if;
    v_entradas := v_entradas + 1;
  end loop;

  if v_conta is not null and v_nfe.total_cents > 0 then
    insert into public.financial_entries
      (organization_id, account_id, direction, amount_cents, description, entry_date, status, origin, created_by_user_id)
    values (p_org, v_conta, 'out', v_nfe.total_cents,
            left('NF-e ' || v_nfe.numero || '/' || v_nfe.serie || ' — ' || v_nfe.emitente_nome, 300),
            current_date, 'pending', 'manual', auth.uid())
    returning id into v_fin;
  end if;

  update public.clinic_estoque_nfe
     set status = 'lancada', local_id = v_local, financial_entry_id = v_fin, lancada_em = now(), lancada_por = auth.uid()
   where id = p_nfe;
  return jsonb_build_object('entradas', v_entradas, 'financial_entry_id', v_fin);
end $$;
revoke execute on function public.fn_clinic_estoque_nfe_lancar(uuid, uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_nfe_lancar(uuid, uuid, jsonb) to authenticated;

-- ─── 12. S1 + C2: recall a partir do prontuário, auditado e limitado ───────
-- p_tipo = por que se consulta (categoria, nunca texto livre no log):
-- recall_fabricante | alerta_sanitario | evento_adverso | auditoria | outro.
create or replace function public.fn_clinic_estoque_rel_rastreio_lote(p_org uuid, p_lote uuid, p_tipo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote public.clinic_estoque_lotes;
  v_codigo text;
  v_pacientes jsonb;
begin
  if not public.fn_clinic_estoque_pode(p_org, 'estoque.rastreio_lote') then
    raise exception 'acesso_proibido' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('recall_fabricante', 'alerta_sanitario', 'evento_adverso', 'auditoria', 'outro') then
    raise exception 'estoque_dados_invalidos' using errcode = '22023';
  end if;
  select * into v_lote from public.clinic_estoque_lotes l where l.id = p_lote and l.organization_id = p_org;
  if v_lote.id is null then
    raise exception 'estoque_lote_invalido' using errcode = '22023';
  end if;
  -- limite por pessoa: 30 consultas por hora, contadas no próprio log
  if (select count(*) from public.api_audit_log a
       where a.actor_user_id = auth.uid() and a.action = 'clinic.estoque_rastreio_consultado'
         and a.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'estoque_limite_consultas' using errcode = '54000';
  end if;
  v_codigo := upper(btrim(coalesce(v_lote.codigo, '')));

  with insumos as (
    -- o que o PRONTUÁRIO diz: insumo deste produto com este código de lote,
    -- ou insumo cuja baixa saiu deste lote (inclusive pela FEFO)
    select i.id as insumo_id, a.contact_id, a.id as atendimento_id,
           coalesce(pr.executor_user_id, a.professional_user_id) as profissional,
           coalesce(a.finished_at, a.started_at) as data,
           i.quantidade, i.unidade,
           (v_codigo <> '' and upper(btrim(coalesce(i.lote, ''))) = v_codigo) as lote_no_prontuario
      from public.clinic_procedimento_insumos i
      join public.clinic_procedimentos_realizados pr on pr.id = i.procedimento_id and pr.organization_id = p_org
      join public.clinic_atendimentos a on a.id = pr.atendimento_id and a.organization_id = p_org
     where i.organization_id = p_org and i.product_id = v_lote.product_id
       and ((v_codigo <> '' and upper(btrim(coalesce(i.lote, ''))) = v_codigo)
            or exists (select 1 from public.clinic_estoque_operacoes o
                         join public.clinic_estoque_movimentos m on m.operacao_id = o.id and m.organization_id = p_org
                        where o.organization_id = p_org and o.origem_tipo = 'insumo' and o.origem_id = i.id
                          and o.tipo = 'consumo' and m.lote_id = p_lote))
  ),
  situacao as (
    select x.*,
           (select o.id from public.clinic_estoque_operacoes o
             where o.organization_id = p_org and o.origem_tipo = 'insumo' and o.origem_id = x.insumo_id
               and o.tipo = 'consumo' limit 1) as op
      from insumos x
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'contact_id', s.contact_id, 'paciente', ct.name, 'atendimento_id', s.atendimento_id,
           'data', s.data, 'profissional', cp.display_name, 'quantidade', s.quantidade, 'unidade', s.unidade,
           'status', case
             when s.op is null and exists (select 1 from public.clinic_estoque_pendencias p
                                            where p.organization_id = p_org and p.insumo_id = s.insumo_id and p.status = 'aberta')
               then 'pendente'
             when s.op is null then 'sem_baixa'
             when exists (select 1 from public.clinic_estoque_operacoes e
                           where e.organization_id = p_org and e.estorna_operacao_id = s.op) then 'estornado'
             when not exists (select 1 from public.clinic_estoque_movimentos m
                               where m.organization_id = p_org and m.operacao_id = s.op and m.lote_id = p_lote)
               then 'baixado_em_outro_lote'
             when exists (select 1 from public.clinic_estoque_movimentos m
                           where m.organization_id = p_org and m.operacao_id = s.op and m.lote_id = p_lote and m.lote_presumido)
               then 'lote_presumido'
             else 'baixado' end)
         order by s.data desc), '[]'::jsonb)
    into v_pacientes
    from situacao s
    left join public.contacts ct on ct.id = s.contact_id and ct.organization_id = p_org
    left join public.clinic_professionals cp on cp.organization_id = p_org and cp.user_id = s.profissional;

  -- auditoria na MESMA transação: sem registro, sem resposta (só ids e contagem)
  insert into public.api_audit_log (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (p_org, auth.uid(), 'clinic.estoque_rastreio_consultado', 'clinic_estoque_lote', p_lote,
          jsonb_build_object('numero', jsonb_array_length(v_pacientes), 'tipo', p_tipo));

  return jsonb_build_object(
    'lote', jsonb_build_object('id', v_lote.id, 'codigo', v_lote.codigo, 'validade', v_lote.validade,
                               'bloqueado', v_lote.bloqueado_em is not null,
                               'produto', (select c.nome from public.catalog_products c where c.id = v_lote.product_id)),
    'pacientes', v_pacientes);
end $$;
revoke execute on function public.fn_clinic_estoque_rel_rastreio_lote(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_estoque_rel_rastreio_lote(uuid, uuid, text) to authenticated;
-- a versão de 2 argumentos (sem auditoria no banco) sai do alcance do cliente
revoke execute on function public.fn_clinic_estoque_rel_rastreio_lote(uuid, uuid) from authenticated;

-- ─── 13. S2: custo sob `estoque.custos` ────────────────────────────────────
create or replace function public.fn_clinic_estoque_custos_lotes(p_org uuid, p_product uuid)
returns table (lote_id uuid, custo_unitario_cents numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.fn_clinic_estoque_pode(p_org, 'estoque.custos') then
    raise exception 'acesso_proibido' using errcode = '42501';
  end if;
  return query
    select l.id, l.custo_unitario_cents from public.clinic_estoque_lotes l
     where l.organization_id = p_org and (p_product is null or l.product_id = p_product);
end $$;
revoke execute on function public.fn_clinic_estoque_custos_lotes(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_estoque_custos_lotes(uuid, uuid) to authenticated;

-- NF-e (valores da compra): leitura só para quem compra ou vê custos
do $rls$
declare
  t text;
begin
  foreach t in array array['clinic_estoque_nfe', 'clinic_estoque_nfe_itens'] loop
    execute format('drop policy if exists acesso_ler on public.%I', t);
    execute format($p$create policy acesso_ler on public.%I as restrictive for select
                      using (public.fn_has_permission(organization_id, 'estoque.compras')
                             or public.fn_has_permission(organization_id, 'estoque.custos'))$p$, t);
  end loop;
end
$rls$;

-- ─── 14. C13 + S2: privilégio por COLUNA ───────────────────────────────────
-- Grant de select = todas as colunas MENOS as listadas. Coluna nova nessas
-- tabelas precisa entrar num grant (senão fica ilegível para o cliente).
do $col$
declare
  v record;
  v_cols text;
begin
  for v in
    select * from (values
      ('clinic_estoque_movimentos', array['contact_id', 'atendimento_id', 'profissional_user_id', 'custo_unitario_cents']),
      ('clinic_estoque_lotes',      array['custo_unitario_cents']),
      ('clinic_estoque_pendencias', array['atendimento_id', 'insumo_id']),
      ('clinic_estoque_reservas',   array['atendimento_id', 'appointment_id']),
      ('clinic_estoque_operacoes',  array['origem_id'])
    ) as x(tabela, fora)
  loop
    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into v_cols
      from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = v.tabela and c.column_name <> all(v.fora);
    execute format('revoke select on public.%I from authenticated', v.tabela);
    execute format('grant select (%s) on public.%I to authenticated', v_cols, v.tabela);
  end loop;
end
$col$;
