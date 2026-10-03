-- ════════════════════════════════════════════════════════════════════════════
-- 9036 · clinic — estoque: relatórios e rastreio de lote (FORK, estoque E8)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/estoque/plano.md. Quem SOMA é o banco (o PostgREST corta
-- em 1000 linhas sem avisar — lição da 0244). Quatro leituras:
--
--   consumo        o que saiu nos atendimentos no período, por procedimento,
--                  profissional ou produto (líquido de estornos; custo só com
--                  `estoque.custos`); sem paciente;
--   perdas         perdas e encerramentos de frasco no período, por produto e
--                  motivo (líquido de estornos); sem paciente;
--   compra         sugestão de compra: produtos no ponto de pedido ou abaixo do
--                  mínimo, quanto falta para chegar ao dobro do nível de alerta
--                  (em unidade de estoque, arredondado para cima);
--   rastreio_lote  RECALL — quais pacientes receberam um lote, quando, com quem.
--                  Dado de saúde: chave CLÍNICA nova `estoque.rastreio_lote`
--                  (administrador e suporte não recebem por padrão; a rota
--                  audita a leitura).
--
-- E fecha uma porta: quem tem só `estoque.ver` deixa de ler, direto da tabela,
-- a ligação movimento → paciente/atendimento/profissional (privilégio por
-- COLUNA em clinic_estoque_movimentos). As telas do estoque nunca leram essas
-- colunas; o rastreio passa a ser só pela função com a chave clínica.
-- Aditiva e idempotente (também anexada ao fim de supabase/baseline.sql).

-- ─── 1. a ligação com o paciente sai da leitura direta ─────────────────────
revoke select on public.clinic_estoque_movimentos from authenticated;
grant select (id, organization_id, operacao_id, product_id, lote_id, local_id, frasco_id, quantidade,
              custo_unitario_cents, procedure_id, created_at)
  on public.clinic_estoque_movimentos to authenticated;

-- ─── 2. a chave clínica do rastreio ────────────────────────────────────────
insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao, clinica) values
  ('estoque.rastreio_lote', 'estoque', 'rastreio_lote', 'manager', array['estoque.ver', 'prontuario.ver']::text[], false,
   'Rastrear um lote até os pacientes que o receberam (recall)', true)
on conflict (key) do update
  set modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
      depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao,
      clinica = excluded.clinica;

-- quem pode ler (membro da empresa + a permissão); interna
create or replace function public.fn_clinic_estoque_pode(p_org uuid, p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and p_org is not null
     and p_org in (select public.fn_user_org_ids())
     and public.fn_has_permission(p_org, p_permissao)
$$;
revoke execute on function public.fn_clinic_estoque_pode(uuid, text) from public, anon, authenticated;

-- ─── 3. consumo ─────────────────────────────────────────────────────────────
create or replace function public.fn_clinic_estoque_rel_consumo(p_org uuid, p_de date, p_ate date, p_agrupar text)
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
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 400
     or p_agrupar not in ('procedimento', 'profissional', 'produto') then
    raise exception 'estoque_dados_invalidos' using errcode = '22023';
  end if;
  v_custos := public.fn_has_permission(p_org, 'estoque.custos');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'grupo_id', x.grupo_id, 'grupo', x.grupo, 'product_id', x.product_id, 'produto', c.nome,
             'unidade', coalesce(e.unidade_aplicacao, 'un'), 'quantidade', x.quantidade,
             'atendimentos', x.atendimentos,
             'custo_cents', case when v_custos then x.custo end)
           order by x.grupo nulls last, c.nome)
      from (
        select case p_agrupar when 'procedimento' then m.procedure_id
                              when 'profissional' then m.profissional_user_id
                              else m.product_id end as grupo_id,
               case p_agrupar
                 when 'procedimento' then (select pr.name from public.clinic_procedures pr where pr.id = m.procedure_id)
                 when 'profissional' then (select cp.display_name from public.clinic_professionals cp
                                            where cp.organization_id = p_org and cp.user_id = m.profissional_user_id limit 1)
                 else null end as grupo,
               m.product_id,
               -sum(m.quantidade) as quantidade,
               count(distinct m.atendimento_id) as atendimentos,
               round(-sum(m.quantidade * coalesce(m.custo_unitario_cents, 0))) as custo
          from public.clinic_estoque_movimentos m
         where m.organization_id = p_org and m.atendimento_id is not null
           and m.created_at >= p_de and m.created_at < p_ate + 1
         group by 1, 2, m.product_id
        having sum(m.quantidade) <> 0
      ) x
      join public.catalog_products c on c.id = x.product_id
      left join public.clinic_produto_estoque e on e.organization_id = p_org and e.product_id = x.product_id
  ), '[]'::jsonb);
end $$;
revoke execute on function public.fn_clinic_estoque_rel_consumo(uuid, date, date, text) from public, anon;
grant  execute on function public.fn_clinic_estoque_rel_consumo(uuid, date, date, text) to authenticated;

-- ─── 4. perdas ──────────────────────────────────────────────────────────────
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
             'motivo', x.motivo, 'quantidade', x.quantidade, 'ocorrencias', x.ocorrencias,
             'custo_cents', case when v_custos then x.custo end)
           order by x.quantidade desc)
      from (
        select m.product_id,
               case when o.origem_tipo = 'frasco' then 'Frasco encerrado'
                    when o.motivo ilike '%venc%' then 'Vencimento'
                    else coalesce(left(o.motivo, 80), 'Sem motivo') end as motivo,
               -sum(m.quantidade) as quantidade,
               count(distinct o.id) as ocorrencias,
               round(-sum(m.quantidade * coalesce(m.custo_unitario_cents, 0))) as custo
          from public.clinic_estoque_operacoes o
          join public.clinic_estoque_movimentos m on m.organization_id = o.organization_id and m.operacao_id = o.id
         where o.organization_id = p_org and o.tipo = 'perda'
           and o.created_at >= p_de and o.created_at < p_ate + 1
           -- perda estornada não conta
           and not exists (select 1 from public.clinic_estoque_operacoes e2
                            where e2.organization_id = p_org and e2.estorna_operacao_id = o.id)
         group by 1, 2
        having sum(m.quantidade) <> 0
      ) x
      join public.catalog_products c on c.id = x.product_id
      left join public.clinic_produto_estoque e on e.organization_id = p_org and e.product_id = x.product_id
  ), '[]'::jsonb);
end $$;
revoke execute on function public.fn_clinic_estoque_rel_perdas(uuid, date, date) from public, anon;
grant  execute on function public.fn_clinic_estoque_rel_perdas(uuid, date, date) to authenticated;

-- ─── 5. sugestão de compra ──────────────────────────────────────────────────
create or replace function public.fn_clinic_estoque_rel_compra(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.fn_clinic_estoque_pode(p_org, 'estoque.ver') then
    raise exception 'acesso_proibido' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', x.product_id, 'produto', c.nome, 'unidade_aplicacao', x.unidade_aplicacao,
             'unidade_estoque', x.unidade_estoque, 'disponivel', x.disponivel, 'nivel', x.nivel,
             'sugerido', ceil(greatest(0, 2 * x.nivel - x.disponivel) / x.fator)::integer)
           order by c.nome)
      from (
        select e.product_id, e.unidade_aplicacao, e.unidade_estoque, e.fator_conversao as fator,
               greatest(e.estoque_minimo, coalesce(e.ponto_pedido, 0)) as nivel,
               coalesce((select sum(m.quantidade) from public.clinic_estoque_movimentos m
                          join public.clinic_estoque_lotes l on l.id = m.lote_id
                         where m.organization_id = p_org and m.product_id = e.product_id
                           and (l.validade is null or l.validade >= current_date)), 0)
               - coalesce((select sum(r.quantidade) from public.clinic_estoque_reservas r
                            where r.organization_id = p_org and r.product_id = e.product_id and r.status = 'ativa'), 0)
                 as disponivel
          from public.clinic_produto_estoque e
         where e.organization_id = p_org and (e.estoque_minimo > 0 or e.ponto_pedido is not null)
      ) x
      join public.catalog_products c on c.id = x.product_id and c.ativo
     where x.nivel > 0 and x.disponivel <= x.nivel
  ), '[]'::jsonb);
end $$;
revoke execute on function public.fn_clinic_estoque_rel_compra(uuid) from public, anon;
grant  execute on function public.fn_clinic_estoque_rel_compra(uuid) to authenticated;

-- ─── 6. rastreio de lote (recall) — chave clínica ──────────────────────────
create or replace function public.fn_clinic_estoque_rel_rastreio_lote(p_org uuid, p_lote uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote public.clinic_estoque_lotes;
begin
  if not public.fn_clinic_estoque_pode(p_org, 'estoque.rastreio_lote') then
    raise exception 'acesso_proibido' using errcode = '42501';
  end if;
  select * into v_lote from public.clinic_estoque_lotes l where l.id = p_lote and l.organization_id = p_org;
  if v_lote.id is null then
    raise exception 'estoque_lote_invalido' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'lote', jsonb_build_object('id', v_lote.id, 'codigo', v_lote.codigo, 'validade', v_lote.validade,
                               'produto', (select c.nome from public.catalog_products c where c.id = v_lote.product_id)),
    'pacientes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'contact_id', x.contact_id, 'paciente', ct.name, 'atendimento_id', x.atendimento_id,
               'data', x.data, 'profissional', cp.display_name, 'quantidade', x.quantidade)
             order by x.data desc)
        from (
          select m.contact_id, m.atendimento_id, m.profissional_user_id, min(m.created_at) as data,
                 -sum(m.quantidade) as quantidade
            from public.clinic_estoque_movimentos m
           where m.organization_id = p_org and m.lote_id = p_lote and m.atendimento_id is not null
           group by m.contact_id, m.atendimento_id, m.profissional_user_id
          having sum(m.quantidade) < 0
        ) x
        left join public.contacts ct on ct.id = x.contact_id and ct.organization_id = p_org
        left join public.clinic_professionals cp on cp.organization_id = p_org and cp.user_id = x.profissional_user_id
    ), '[]'::jsonb));
end $$;
revoke execute on function public.fn_clinic_estoque_rel_rastreio_lote(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_estoque_rel_rastreio_lote(uuid, uuid) to authenticated;
