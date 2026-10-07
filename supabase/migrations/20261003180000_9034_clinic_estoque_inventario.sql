-- ════════════════════════════════════════════════════════════════════════════
-- 9034 · clinic — estoque: inventário (contagem) por local (FORK, estoque E6)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/estoque/plano.md. Contar o que há de fato num local e
-- acertar o sistema pela contagem — sem apagar nada:
--
--   abrir    fotografa a quantidade de cada lote no local (um inventário aberto por
--            local);
--   contar   registra a quantidade contada de cada lote (na unidade de
--            aplicação); lote não contado fica como está;
--   fechar   UMA operação `inventario` com a diferença (contado − saldo no
--            momento de fechar) de cada lote contado, com motivo; saldo nunca
--            negativo (conferência por gaveta da 9032 — frasco aberto com
--            conteúdo errado se encerra antes);
--   cancelar sem efeito no saldo.
--
--   clinic_estoque_inventarios        cabeçalho (local, status, quem, quando)
--   clinic_estoque_inventario_itens   lote, saldo fotografado, contado
--
-- Permissão `estoque.inventariar`. Aditiva e idempotente (anexada ao baseline).

create table if not exists public.clinic_estoque_inventarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  local_id uuid not null,
  status text not null default 'aberto',
  motivo text,
  operacao_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid,
  fechado_em timestamptz,
  fechado_por uuid,
  constraint clinic_estoque_inventarios_org_id_key unique (organization_id, id),
  constraint clinic_estoque_inventarios_status check (status in ('aberto', 'fechado', 'cancelado')),
  constraint clinic_estoque_inventarios_motivo check (motivo is null or char_length(btrim(motivo)) between 1 and 300),
  constraint clinic_estoque_inventarios_local_fk foreign key (organization_id, local_id)
    references public.clinic_estoque_locais (organization_id, id),
  constraint clinic_estoque_inventarios_operacao_fk foreign key (organization_id, operacao_id)
    references public.clinic_estoque_operacoes (organization_id, id)
);
create unique index if not exists clinic_estoque_inventarios_um_aberto
  on public.clinic_estoque_inventarios (organization_id, local_id) where status = 'aberto';

create table if not exists public.clinic_estoque_inventario_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inventario_id uuid not null,
  product_id uuid not null references public.catalog_products(id),
  lote_id uuid not null,
  quantidade_sistema numeric(14,3) not null,
  contado numeric(14,3),
  contado_em timestamptz,
  contado_por uuid,
  constraint clinic_estoque_inventario_itens_unico unique (inventario_id, lote_id),
  constraint clinic_estoque_inventario_itens_contado check (contado is null or contado >= 0),
  constraint clinic_estoque_inventario_itens_inventario_fk foreign key (organization_id, inventario_id)
    references public.clinic_estoque_inventarios (organization_id, id) on delete cascade,
  constraint clinic_estoque_inventario_itens_lote_fk foreign key (organization_id, lote_id)
    references public.clinic_estoque_lotes (organization_id, id)
);

do $rls$
declare
  t text;
begin
  foreach t in array array['clinic_estoque_inventarios', 'clinic_estoque_inventario_itens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format($p$create policy tenant_isolation_%s_all on public.%I
        using ((organization_id in (select public.fn_user_org_ids()))
               and public.fn_role_at_least(organization_id, 'viewer'))
        with check ((organization_id in (select public.fn_user_org_ids()))
               and public.fn_role_at_least(organization_id, 'viewer'))$p$, t, t);
    execute format('drop policy if exists acesso_ler on public.%I', t);
    execute format($p$create policy acesso_ler on public.%I as restrictive for select
                      using (public.fn_has_permission(organization_id, 'estoque.ver'))$p$, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end
$rls$;

-- ─── abrir ──────────────────────────────────────────────────────────────────
create or replace function public.fn_clinic_estoque_inventario_abrir(p_org uuid, p_local uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_n integer;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.inventariar');
  perform public.fn_clinic_estoque_local_valido(p_org, p_local);
  if exists (select 1 from public.clinic_estoque_inventarios i
              where i.organization_id = p_org and i.local_id = p_local and i.status = 'aberto') then
    raise exception 'estoque_inventario_aberto' using errcode = '23505';
  end if;
  insert into public.clinic_estoque_inventarios (organization_id, local_id, created_by)
  values (p_org, p_local, auth.uid())
  returning id into v_id;
  insert into public.clinic_estoque_inventario_itens (organization_id, inventario_id, product_id, lote_id, quantidade_sistema)
  select p_org, v_id, s.product_id, s.lote_id, sum(s.saldo)
    from public.clinic_estoque_saldos s
   where s.organization_id = p_org and s.local_id = p_local
   group by s.product_id, s.lote_id
  having sum(s.saldo) <> 0;
  get diagnostics v_n = row_count;
  return jsonb_build_object('id', v_id, 'itens', v_n);
end $$;
revoke execute on function public.fn_clinic_estoque_inventario_abrir(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_estoque_inventario_abrir(uuid, uuid) to authenticated;

-- ─── contar um lote (nulo = desfazer a contagem) ───────────────────────────
create or replace function public.fn_clinic_estoque_inventario_contar(p_org uuid, p_item uuid, p_contado numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv uuid;
  v_status text;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.inventariar');
  select it.inventario_id into v_inv from public.clinic_estoque_inventario_itens it
   where it.id = p_item and it.organization_id = p_org;
  if v_inv is null then
    raise exception 'estoque_inventario_invalido' using errcode = 'P0002';
  end if;
  select i.status into v_status from public.clinic_estoque_inventarios i where i.id = v_inv for update;
  if v_status <> 'aberto' then
    raise exception 'estoque_inventario_fechado' using errcode = '22023';
  end if;
  if p_contado is not null and (p_contado < 0 or p_contado > 10000000) then
    raise exception 'estoque_quantidade_invalida' using errcode = '22023';
  end if;
  update public.clinic_estoque_inventario_itens
     set contado = round(p_contado, 3), contado_em = case when p_contado is null then null else now() end,
         contado_por = case when p_contado is null then null else auth.uid() end
   where id = p_item;
  return jsonb_build_object('contado', p_contado);
end $$;
revoke execute on function public.fn_clinic_estoque_inventario_contar(uuid, uuid, numeric) from public, anon;
grant  execute on function public.fn_clinic_estoque_inventario_contar(uuid, uuid, numeric) to authenticated;

-- ─── fechar: uma operação com as diferenças ────────────────────────────────
create or replace function public.fn_clinic_estoque_inventario_fechar(p_org uuid, p_inventario uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.clinic_estoque_inventarios;
  v_lotes uuid[];
  v_op uuid;
  v_ajustes integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.inventariar');
  select * into v_inv from public.clinic_estoque_inventarios i
   where i.id = p_inventario and i.organization_id = p_org for update;
  if v_inv.id is null then
    raise exception 'estoque_inventario_invalido' using errcode = 'P0002';
  end if;
  if v_inv.status <> 'aberto' then
    raise exception 'estoque_inventario_fechado' using errcode = '22023';
  end if;
  select array_agg(it.lote_id) into v_lotes from public.clinic_estoque_inventario_itens it
   where it.inventario_id = p_inventario and it.contado is not null;
  perform public.fn_clinic_estoque_travar(p_org, coalesce(v_lotes, '{}'));

  select count(*) into v_ajustes from public.clinic_estoque_inventario_itens it
   where it.inventario_id = p_inventario and it.contado is not null
     and it.contado <> public.fn_clinic_estoque_saldo(p_org, it.lote_id, v_inv.local_id);
  if v_ajustes > 0 then
    insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, origem_id, motivo, ator)
    values (p_org, 'inventario', 'inventario', p_inventario, left(coalesce(v_motivo, 'Inventário'), 300), auth.uid())
    returning id into v_op;
    insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, quantidade, custo_unitario_cents)
    select p_org, v_op, it.product_id, it.lote_id, v_inv.local_id,
           it.contado - public.fn_clinic_estoque_saldo(p_org, it.lote_id, v_inv.local_id), l.custo_unitario_cents
      from public.clinic_estoque_inventario_itens it
      join public.clinic_estoque_lotes l on l.id = it.lote_id
     where it.inventario_id = p_inventario and it.contado is not null
       and it.contado <> public.fn_clinic_estoque_saldo(p_org, it.lote_id, v_inv.local_id);
    perform public.fn_clinic_estoque_conferir_saldos(p_org, v_op);
  end if;
  update public.clinic_estoque_inventarios
     set status = 'fechado', motivo = v_motivo, operacao_id = v_op, fechado_em = now(), fechado_por = auth.uid()
   where id = p_inventario;
  return jsonb_build_object('ajustes', v_ajustes, 'operacao_id', v_op);
end $$;
revoke execute on function public.fn_clinic_estoque_inventario_fechar(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_estoque_inventario_fechar(uuid, uuid, text) to authenticated;

-- ─── cancelar ───────────────────────────────────────────────────────────────
create or replace function public.fn_clinic_estoque_inventario_cancelar(p_org uuid, p_inventario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.inventariar');
  select i.status into v_status from public.clinic_estoque_inventarios i
   where i.id = p_inventario and i.organization_id = p_org for update;
  if v_status is null then
    raise exception 'estoque_inventario_invalido' using errcode = 'P0002';
  end if;
  if v_status <> 'aberto' then
    raise exception 'estoque_inventario_fechado' using errcode = '22023';
  end if;
  update public.clinic_estoque_inventarios set status = 'cancelado', fechado_em = now(), fechado_por = auth.uid()
   where id = p_inventario;
  return jsonb_build_object('status', 'cancelado');
end $$;
revoke execute on function public.fn_clinic_estoque_inventario_cancelar(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_estoque_inventario_cancelar(uuid, uuid) to authenticated;
