-- ════════════════════════════════════════════════════════════════════════════
-- 9029 · clinic — estoque: sincronia com o cadastro de produtos (FORK, estoque E1)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/estoque/plano.md. A quantidade do cadastro de produtos
-- (`catalog_products.quantidade`, que a loja e o agente de IA leem) passa a ser
-- DERIVADA do estoque nos produtos com `clinic_produto_estoque.gerenciado`, nas
-- empresas com a opção `settings.clinic.estoque` ligada:
--
--   quantidade = greatest(0, floor(saldo total / fator_conversao))
--
-- (saldo na unidade de aplicação; quantidade na unidade de estoque: 250 U de
-- toxina com frasco = 100 U → 2.)
--
--   • depois de cada INSERT em clinic_estoque_movimentos (por comando), os
--     produtos tocados são recalculados;
--   • mudar `gerenciado`/`fator_conversao` e ligar a opção recalculam também;
--   • quem edita `quantidade` direto (tela de produtos, importação da planilha,
--     UPDATE solto) num produto gerenciado NÃO sobrescreve: o trigger troca o
--     valor pelo saldo. Só a função de sincronia escreve (GUC
--     `clinic.estoque_sync`, local à transação).
--
-- NÚCLEO: dois triggers em `catalog_products`/movimentos — registrado no
-- UPSTREAM.md. Opção desligada ou produto não gerenciado = comportamento antigo.
-- Aditiva e idempotente (também anexada ao fim de supabase/baseline.sql).

-- ─── o saldo derivado de um produto (na unidade de estoque) ────────────────
create or replace function public.fn_clinic_estoque_qtd_catalogo(p_org uuid, p_product uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(0, floor(coalesce(sum(m.quantidade), 0) / nullif(e.fator_conversao, 0)))::integer
    from public.clinic_produto_estoque e
    left join public.clinic_estoque_movimentos m
      on m.organization_id = e.organization_id and m.product_id = e.product_id
   where e.organization_id = p_org and e.product_id = p_product
   group by e.fator_conversao
$$;
revoke execute on function public.fn_clinic_estoque_qtd_catalogo(uuid, uuid) from public, anon, authenticated;

-- O produto está sob o estoque? (config gerenciada + opção da empresa ligada)
create or replace function public.fn_clinic_estoque_gerencia(p_org uuid, p_product uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.clinic_produto_estoque e
      join public.organizations o on o.id = e.organization_id
     where e.organization_id = p_org
       and e.product_id = p_product
       and e.gerenciado
       and (o.settings -> 'clinic' -> 'estoque') = 'true'::jsonb)
$$;
revoke execute on function public.fn_clinic_estoque_gerencia(uuid, uuid) from public, anon, authenticated;

-- ─── a sincronia: grava a quantidade derivada nos produtos indicados ────────
-- Trava as linhas do catálogo em ordem de id ANTES de somar: o comando seguinte
-- (READ COMMITTED) enxerga os movimentos de quem terminou antes — duas baixas
-- simultâneas no mesmo produto não deixam a quantidade com a soma velha.
create or replace function public.fn_clinic_estoque_sincronizar(p_org uuid, p_products uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
  v_n integer;
begin
  select coalesce(array_agg(c.id order by c.id), '{}')
    into v_ids
    from public.catalog_products c
   where c.organization_id = p_org
     and c.id = any(coalesce(p_products, '{}'))
     and public.fn_clinic_estoque_gerencia(p_org, c.id);
  if cardinality(v_ids) = 0 then
    return 0;
  end if;
  perform 1 from public.catalog_products c where c.id = any(v_ids) order by c.id for update;
  perform set_config('clinic.estoque_sync', 'on', true);
  update public.catalog_products c
     set quantidade = coalesce(public.fn_clinic_estoque_qtd_catalogo(p_org, c.id), 0)
   where c.id = any(v_ids)
     and c.quantidade is distinct from coalesce(public.fn_clinic_estoque_qtd_catalogo(p_org, c.id), 0);
  get diagnostics v_n = row_count;
  perform set_config('clinic.estoque_sync', 'off', true);
  return v_n;
end $$;
revoke execute on function public.fn_clinic_estoque_sincronizar(uuid, uuid[]) from public, anon, authenticated;

-- ─── gatilho 1: movimento novo → recalcula os produtos tocados ─────────────
create or replace function public.fn_clinic_estoque_movimentos_sincronizar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in
    select n.organization_id, array_agg(distinct n.product_id) as produtos
      from novos n
     group by n.organization_id
     order by n.organization_id
  loop
    perform public.fn_clinic_estoque_sincronizar(r.organization_id, r.produtos);
  end loop;
  return null;
end $$;
revoke execute on function public.fn_clinic_estoque_movimentos_sincronizar() from public, anon, authenticated;
drop trigger if exists trg_clinic_estoque_movimentos_sincronizar on public.clinic_estoque_movimentos;
create trigger trg_clinic_estoque_movimentos_sincronizar
  after insert on public.clinic_estoque_movimentos
  referencing new table as novos
  for each statement execute function public.fn_clinic_estoque_movimentos_sincronizar();

-- ─── gatilho 2: mudou gerenciado/fator → recalcula aquele produto ──────────
-- Adiado para o fim da transação: a configuração nasce com os padrões
-- (gerenciado) e é gravada logo em seguida; a sincronia olha o estado FINAL —
-- configurar como "não gerenciado" não zera a quantidade digitada.
create or replace function public.fn_clinic_produto_estoque_sincronizar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_clinic_estoque_sincronizar(new.organization_id, array[new.product_id]);
  return null;
end $$;
revoke execute on function public.fn_clinic_produto_estoque_sincronizar() from public, anon, authenticated;
drop trigger if exists trg_clinic_produto_estoque_sincronizar on public.clinic_produto_estoque;
create constraint trigger trg_clinic_produto_estoque_sincronizar
  after insert or update of gerenciado, fator_conversao on public.clinic_produto_estoque
  deferrable initially deferred
  for each row execute function public.fn_clinic_produto_estoque_sincronizar();

-- ─── gatilho 3 (núcleo): a quantidade de produto gerenciado não se digita ───
-- Tela de produtos, importação da planilha ou UPDATE direto: o valor novo é
-- trocado pelo saldo. Só a sincronia (GUC ligado) passa.
create or replace function public.fn_clinic_catalogo_quantidade_do_estoque()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.quantidade is distinct from old.quantidade
     and coalesce(current_setting('clinic.estoque_sync', true), '') <> 'on'
     and public.fn_clinic_estoque_gerencia(new.organization_id, new.id) then
    new.quantidade := coalesce(public.fn_clinic_estoque_qtd_catalogo(new.organization_id, new.id), 0);
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_catalogo_quantidade_do_estoque() from public, anon, authenticated;
drop trigger if exists trg_catalog_products_quantidade_do_estoque on public.catalog_products;
create trigger trg_catalog_products_quantidade_do_estoque
  before update of quantidade on public.catalog_products
  for each row execute function public.fn_clinic_catalogo_quantidade_do_estoque();

-- ─── a opção: ligar também ressincroniza todos os produtos gerenciados ─────
-- Igual à da 9028 + a ressincronia no fim.
create or replace function public.fn_clinic_definir_estoque(p_org uuid, p_ligado boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes boolean;
  v_produtos uuid[];
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

  select (o.settings -> 'clinic' -> 'estoque') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('estoque', p_ligado),
           true)
   where id = p_org;

  if p_ligado and not exists (select 1 from public.clinic_estoque_locais l where l.organization_id = p_org) then
    insert into public.clinic_estoque_locais (organization_id, nome, tipo, padrao, created_by, updated_by)
    values (p_org, 'Estoque central', 'central', true, auth.uid(), auth.uid());
  end if;

  if p_ligado then
    select array_agg(e.product_id) into v_produtos
      from public.clinic_produto_estoque e
     where e.organization_id = p_org and e.gerenciado;
    perform public.fn_clinic_estoque_sincronizar(p_org, v_produtos);
  end if;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;
revoke execute on function public.fn_clinic_definir_estoque(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_estoque(uuid, boolean) to authenticated;
