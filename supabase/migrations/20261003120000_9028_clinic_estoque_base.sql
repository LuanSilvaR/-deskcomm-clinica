-- ════════════════════════════════════════════════════════════════════════════
-- 9028 · clinic — estoque: base (FORK, estoque E0)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/estoque/plano.md. ESTOQUE = SOMA DE MOVIMENTOS.
--
--   clinic_produto_estoque   configuração de estoque do produto (1:1 com
--                            catalog_products — a tabela do núcleo não muda)
--   clinic_estoque_locais    onde o estoque fica (central, sala, carrinho…)
--   clinic_estoque_lotes     lote + validade + custo de cada produto
--   clinic_estoque_operacoes o cabeçalho de cada movimentação (quem, por quê)
--   clinic_estoque_movimentos as linhas, com sinal: + entra, − sai
--   clinic_estoque_saldos    (view) saldo = soma dos movimentos
--
-- Regras no BANCO:
--   • operações e movimentos só ACRESCENTAM: UPDATE/DELETE recusados até para o
--     service role; correção é ESTORNO (operação nova com as linhas invertidas);
--   • saldo de um lote num local nunca fica negativo: quem tira trava o lote
--     (FOR UPDATE, em ordem de id) e confere depois de gravar;
--   • tudo é escrito por funções fn_clinic_estoque_* (permissão estoque.* +
--     opção ligada); authenticated só LÊ, e com estoque.ver.
--   • quantidades na UNIDADE DE APLICAÇÃO do produto (U, mL, un…); a entrada
--     pode vir na unidade de estoque e é convertida pelo fator.
-- A tela nasce desligada: settings.clinic.estoque. Idempotente.

-- ─── configuração de estoque do produto ─────────────────────────────────────
create table if not exists public.clinic_produto_estoque (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  ean text,
  ncm text,
  registro_anvisa text,
  unidade_estoque text not null default 'un',
  unidade_aplicacao text not null default 'un',
  fator_conversao numeric(14,3) not null default 1,
  fracionavel boolean not null default false,
  validade_pos_abertura_horas integer,
  rastreado boolean not null default false,
  controlado boolean not null default false,
  conselhos_permitidos text[] not null default '{}',
  estoque_minimo numeric(14,3) not null default 0,
  ponto_pedido numeric(14,3),
  gerenciado boolean not null default true,
  versao integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint clinic_produto_estoque_unico unique (organization_id, product_id),
  constraint clinic_produto_estoque_org_id_key unique (organization_id, id),
  constraint clinic_produto_estoque_ean check (ean is null or ean ~ '^[0-9]{8,14}$'),
  constraint clinic_produto_estoque_ncm check (ncm is null or ncm ~ '^[0-9]{8}$'),
  constraint clinic_produto_estoque_anvisa check (registro_anvisa is null or char_length(btrim(registro_anvisa)) between 1 and 40),
  constraint clinic_produto_estoque_unidades check (
    char_length(btrim(unidade_estoque)) between 1 and 20 and char_length(btrim(unidade_aplicacao)) between 1 and 20),
  constraint clinic_produto_estoque_fator check (fator_conversao > 0),
  constraint clinic_produto_estoque_pos_abertura check (validade_pos_abertura_horas is null or validade_pos_abertura_horas between 1 and 8760),
  constraint clinic_produto_estoque_minimos check (estoque_minimo >= 0 and (ponto_pedido is null or ponto_pedido >= 0)),
  constraint clinic_produto_estoque_conselhos check (
    conselhos_permitidos <@ array['CRM','CRO','COREN','CRBM','CFF','CREFITO','outro']::text[])
);
drop trigger if exists clinic_produto_estoque_updated_at on public.clinic_produto_estoque;
create trigger clinic_produto_estoque_updated_at before update on public.clinic_produto_estoque
  for each row execute function public.fn_set_updated_at();

-- ─── locais ─────────────────────────────────────────────────────────────────
create table if not exists public.clinic_estoque_locais (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null,
  tipo text not null default 'central',
  resource_id uuid references public.clinic_resources(id) on delete set null,
  padrao boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint clinic_estoque_locais_org_id_key unique (organization_id, id),
  constraint clinic_estoque_locais_nome check (char_length(btrim(nome)) between 1 and 80),
  constraint clinic_estoque_locais_tipo check (tipo in ('central', 'sala', 'carrinho', 'farmacia', 'outro'))
);
create unique index if not exists clinic_estoque_locais_nome_unico
  on public.clinic_estoque_locais (organization_id, lower(btrim(nome)));
create unique index if not exists clinic_estoque_locais_um_padrao
  on public.clinic_estoque_locais (organization_id) where padrao;
drop trigger if exists clinic_estoque_locais_updated_at on public.clinic_estoque_locais;
create trigger clinic_estoque_locais_updated_at before update on public.clinic_estoque_locais
  for each row execute function public.fn_set_updated_at();

-- ─── lotes ──────────────────────────────────────────────────────────────────
-- codigo nulo = "sem lote" (produto não rastreado). Custo em centavos, com
-- casas decimais (custo unitário de 1 U de toxina é fração de centavo × 100).
create table if not exists public.clinic_estoque_lotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.catalog_products(id),
  codigo text,
  validade date,
  custo_unitario_cents numeric(14,4),
  fornecedor_id uuid,
  nfe_item_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint clinic_estoque_lotes_org_id_key unique (organization_id, id),
  constraint clinic_estoque_lotes_codigo check (codigo is null or char_length(btrim(codigo)) between 1 and 60),
  constraint clinic_estoque_lotes_custo check (custo_unitario_cents is null or custo_unitario_cents >= 0)
);
create unique index if not exists clinic_estoque_lotes_unico
  on public.clinic_estoque_lotes (organization_id, product_id, coalesce(codigo, ''), coalesce(validade, 'infinity'::date));
create index if not exists clinic_estoque_lotes_validade_idx
  on public.clinic_estoque_lotes (organization_id, validade) where validade is not null;

-- ─── operações (cabeçalho) e movimentos (linhas) ────────────────────────────
create table if not exists public.clinic_estoque_operacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo text not null,
  origem_tipo text,
  origem_id uuid,
  estorna_operacao_id uuid,
  motivo text,
  ator uuid,
  created_at timestamptz not null default now(),
  constraint clinic_estoque_operacoes_org_id_key unique (organization_id, id),
  constraint clinic_estoque_operacoes_tipo check (tipo in (
    'entrada', 'consumo', 'transferencia', 'perda', 'ajuste', 'inventario', 'abertura_frasco', 'estorno')),
  constraint clinic_estoque_operacoes_motivo check (motivo is null or char_length(btrim(motivo)) between 1 and 300),
  constraint clinic_estoque_operacoes_estorno check ((tipo = 'estorno') = (estorna_operacao_id is not null)),
  constraint clinic_estoque_operacoes_estorna_fk foreign key (organization_id, estorna_operacao_id)
    references public.clinic_estoque_operacoes (organization_id, id)
);
-- Idempotência: a mesma origem (ex.: um insumo do prontuário) gera uma operação só.
create unique index if not exists clinic_estoque_operacoes_origem_unica
  on public.clinic_estoque_operacoes (organization_id, origem_tipo, origem_id)
  where origem_id is not null and tipo <> 'estorno';
-- Uma operação é estornada no máximo uma vez.
create unique index if not exists clinic_estoque_operacoes_estorno_unico
  on public.clinic_estoque_operacoes (organization_id, estorna_operacao_id) where estorna_operacao_id is not null;
create index if not exists clinic_estoque_operacoes_data_idx
  on public.clinic_estoque_operacoes (organization_id, created_at desc);

create table if not exists public.clinic_estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  operacao_id uuid not null,
  product_id uuid not null references public.catalog_products(id),
  lote_id uuid not null,
  local_id uuid not null,
  frasco_id uuid,
  quantidade numeric(14,3) not null,
  custo_unitario_cents numeric(14,4),
  -- só no consumo (prontuário), para relatório e rastreio por lote:
  atendimento_id uuid,
  contact_id uuid,
  profissional_user_id uuid,
  procedure_id uuid,
  created_at timestamptz not null default now(),
  constraint clinic_estoque_movimentos_quantidade check (quantidade <> 0),
  constraint clinic_estoque_movimentos_operacao_fk foreign key (organization_id, operacao_id)
    references public.clinic_estoque_operacoes (organization_id, id),
  constraint clinic_estoque_movimentos_lote_fk foreign key (organization_id, lote_id)
    references public.clinic_estoque_lotes (organization_id, id),
  constraint clinic_estoque_movimentos_local_fk foreign key (organization_id, local_id)
    references public.clinic_estoque_locais (organization_id, id)
);
create index if not exists clinic_estoque_movimentos_saldo_idx
  on public.clinic_estoque_movimentos (organization_id, product_id, lote_id, local_id);
create index if not exists clinic_estoque_movimentos_operacao_idx
  on public.clinic_estoque_movimentos (organization_id, operacao_id);
create index if not exists clinic_estoque_movimentos_lote_idx
  on public.clinic_estoque_movimentos (organization_id, lote_id, local_id);
create index if not exists clinic_estoque_movimentos_atendimento_idx
  on public.clinic_estoque_movimentos (organization_id, atendimento_id) where atendimento_id is not null;

-- Só acrescenta: UPDATE recusado sempre; DELETE só na cascata da exclusão da
-- empresa (profundidade > 1), nunca pedido direto — vale até para service role.
create or replace function public.fn_clinic_estoque_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'estoque_imutavel' using errcode = '55000';
end $$;
revoke execute on function public.fn_clinic_estoque_imutavel() from public, anon, authenticated;
drop trigger if exists trg_clinic_estoque_operacoes_imutavel on public.clinic_estoque_operacoes;
create trigger trg_clinic_estoque_operacoes_imutavel before update or delete on public.clinic_estoque_operacoes
  for each row execute function public.fn_clinic_estoque_imutavel();
drop trigger if exists trg_clinic_estoque_movimentos_imutavel on public.clinic_estoque_movimentos;
create trigger trg_clinic_estoque_movimentos_imutavel before update or delete on public.clinic_estoque_movimentos
  for each row execute function public.fn_clinic_estoque_imutavel();

-- ─── saldo = soma dos movimentos ────────────────────────────────────────────
create or replace view public.clinic_estoque_saldos
with (security_invoker = true) as
  select m.organization_id, m.product_id, m.lote_id, m.local_id, sum(m.quantidade)::numeric(14,3) as saldo
    from public.clinic_estoque_movimentos m
   group by m.organization_id, m.product_id, m.lote_id, m.local_id
  having sum(m.quantidade) <> 0;
revoke all on public.clinic_estoque_saldos from anon;
grant select on public.clinic_estoque_saldos to authenticated;

-- ─── RLS: membro lê com estoque.ver; ninguém escreve direto ─────────────────
do $rls$
declare
  t text;
begin
  foreach t in array array[
    'clinic_produto_estoque', 'clinic_estoque_locais', 'clinic_estoque_lotes',
    'clinic_estoque_operacoes', 'clinic_estoque_movimentos'] loop
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
  -- o histórico não se apaga nem por service role (o trigger também recusa)
  execute 'revoke update, delete, truncate on public.clinic_estoque_operacoes from service_role';
  execute 'revoke update, delete, truncate on public.clinic_estoque_movimentos from service_role';
end
$rls$;

-- ─── permissões ─────────────────────────────────────────────────────────────
insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao, clinica) values
  ('estoque.ver', 'estoque', 'ver', 'agent', array[]::text[], false, 'Ver saldos, lotes, validades e movimentações do estoque', false),
  ('estoque.movimentar', 'estoque', 'movimentar', 'manager', array['estoque.ver']::text[], false, 'Dar entrada, transferir entre locais e registrar perdas', false),
  ('estoque.inventariar', 'estoque', 'inventariar', 'manager', array['estoque.ver']::text[], false, 'Ajustar saldo e fazer inventário', false),
  ('estoque.compras', 'estoque', 'compras', 'manager', array['estoque.ver']::text[], false, 'Importar NF-e, conferir e lançar compras', false),
  ('estoque.configurar', 'estoque', 'configurar', 'manager', array['estoque.ver']::text[], false, 'Configurar produtos do estoque (unidades, lote, mínimo) e locais', false),
  ('estoque.custos', 'estoque', 'custos', 'manager', array['estoque.ver']::text[], false, 'Ver custos de lotes e do estoque', false),
  ('estoque.estornar', 'estoque', 'estornar', 'manager', array['estoque.ver']::text[], true, 'Estornar uma movimentação de estoque, com motivo', false)
on conflict (key) do update
  set modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
      depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao,
      clinica = excluded.clinica;

-- Administrador: todas. Modelos (gerente/atendente/visualizador): pelo nível.
insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
select r.organization_id, r.id, p.key
  from public.clinic_roles r
  join public.clinic_permissions p on p.modulo = 'estoque'
 where r.system_key = 'administrador'
    or (r.system_key = 'gerente' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('manager'))
    or (r.system_key = 'atendente' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('agent'))
    or (r.system_key = 'visualizador' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('viewer'))
on conflict do nothing;

-- ─── a opção: settings.clinic.estoque (nasce desligada) ────────────────────
-- Ao ligar pela primeira vez, cria o local padrão "Estoque central".
create or replace function public.fn_clinic_definir_estoque(p_org uuid, p_ligado boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes boolean;
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

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;
revoke execute on function public.fn_clinic_definir_estoque(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_estoque(uuid, boolean) to authenticated;

-- ─── peças internas ─────────────────────────────────────────────────────────
-- Permissão + opção ligada. Interna (só as funções fn_clinic_estoque_* chamam).
create or replace function public.fn_clinic_estoque_exigir(p_org uuid, p_permissao text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_acesso_exigir(p_org, p_permissao);
  if not coalesce((select (o.settings -> 'clinic' -> 'estoque') = 'true'::jsonb
                     from public.organizations o where o.id = p_org), false) then
    raise exception 'estoque_desligado' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.fn_clinic_estoque_exigir(uuid, text) from public, anon, authenticated;

-- Configuração do produto; cria a padrão (un, fator 1) se ainda não existe.
create or replace function public.fn_clinic_estoque_config(p_org uuid, p_product uuid)
returns public.clinic_produto_estoque
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.clinic_produto_estoque;
begin
  if not exists (select 1 from public.catalog_products c where c.id = p_product and c.organization_id = p_org) then
    raise exception 'estoque_produto_invalido' using errcode = '22023';
  end if;
  insert into public.clinic_produto_estoque (organization_id, product_id, created_by, updated_by)
  values (p_org, p_product, auth.uid(), auth.uid())
  on conflict (organization_id, product_id) do nothing;
  select * into v from public.clinic_produto_estoque e where e.organization_id = p_org and e.product_id = p_product;
  return v;
end $$;
revoke execute on function public.fn_clinic_estoque_config(uuid, uuid) from public, anon, authenticated;

-- O lote (cria se é novo). Produto rastreado exige código e validade.
create or replace function public.fn_clinic_estoque_lote(
  p_org uuid, p_product uuid, p_codigo text, p_validade date, p_custo numeric)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg public.clinic_produto_estoque;
  v_codigo text := nullif(btrim(coalesce(p_codigo, '')), '');
  v_id uuid;
begin
  v_cfg := public.fn_clinic_estoque_config(p_org, p_product);
  if v_cfg.rastreado and (v_codigo is null or p_validade is null) then
    raise exception 'estoque_lote_obrigatorio' using errcode = '22023';
  end if;
  select l.id into v_id from public.clinic_estoque_lotes l
   where l.organization_id = p_org and l.product_id = p_product
     and coalesce(l.codigo, '') = coalesce(v_codigo, '')
     and coalesce(l.validade, 'infinity'::date) = coalesce(p_validade, 'infinity'::date);
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

-- Saldo de um lote num local (soma dos movimentos).
create or replace function public.fn_clinic_estoque_saldo(p_org uuid, p_lote uuid, p_local uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(m.quantidade), 0)::numeric
    from public.clinic_estoque_movimentos m
   where m.organization_id = p_org and m.lote_id = p_lote and m.local_id = p_local
$$;
revoke execute on function public.fn_clinic_estoque_saldo(uuid, uuid, uuid) from public, anon, authenticated;

-- Depois de gravar: nenhum (lote, local) da operação pode ter ficado negativo.
create or replace function public.fn_clinic_estoque_conferir_saldos(p_org uuid, p_operacao uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from (select distinct m.lote_id, m.local_id from public.clinic_estoque_movimentos m
                    where m.organization_id = p_org and m.operacao_id = p_operacao) x
     where public.fn_clinic_estoque_saldo(p_org, x.lote_id, x.local_id) < 0
  ) then
    raise exception 'estoque_insuficiente' using errcode = '23514';
  end if;
end $$;
revoke execute on function public.fn_clinic_estoque_conferir_saldos(uuid, uuid) from public, anon, authenticated;

-- Trava os lotes em ordem de id (evita deadlock entre duas saídas concorrentes).
create or replace function public.fn_clinic_estoque_travar(p_org uuid, p_lotes uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform 1 from public.clinic_estoque_lotes l
   where l.organization_id = p_org and l.id = any(p_lotes)
   order by l.id
   for update;
end $$;
revoke execute on function public.fn_clinic_estoque_travar(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.fn_clinic_estoque_local_valido(p_org uuid, p_local uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_local is null or not exists (
    select 1 from public.clinic_estoque_locais l where l.id = p_local and l.organization_id = p_org and l.ativo) then
    raise exception 'estoque_local_invalido' using errcode = '22023';
  end if;
end $$;
revoke execute on function public.fn_clinic_estoque_local_valido(uuid, uuid) from public, anon, authenticated;

create or replace function public.fn_clinic_estoque_lote_da_org(p_org uuid, p_lote uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_product uuid;
begin
  select l.product_id into v_product from public.clinic_estoque_lotes l where l.id = p_lote and l.organization_id = p_org;
  if v_product is null then
    raise exception 'estoque_lote_invalido' using errcode = '22023';
  end if;
  return v_product;
end $$;
revoke execute on function public.fn_clinic_estoque_lote_da_org(uuid, uuid) from public, anon, authenticated;

-- ─── configurar produto e local ─────────────────────────────────────────────
create or replace function public.fn_clinic_estoque_produto_salvar(p_org uuid, p_product uuid, p_dados jsonb, p_versao_esperada integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg public.clinic_produto_estoque;
  v_versao integer;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.configurar');
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'estoque_dados_invalidos' using errcode = '22023';
  end if;
  v_cfg := public.fn_clinic_estoque_config(p_org, p_product);
  perform 1 from public.clinic_produto_estoque e where e.id = v_cfg.id for update;
  if p_versao_esperada is not null and v_cfg.versao <> p_versao_esperada then
    raise exception 'registro_conflito' using errcode = '40001';
  end if;
  update public.clinic_produto_estoque e set
    ean = nullif(btrim(coalesce(p_dados ->> 'ean', '')), ''),
    ncm = nullif(btrim(coalesce(p_dados ->> 'ncm', '')), ''),
    registro_anvisa = nullif(btrim(coalesce(p_dados ->> 'registro_anvisa', '')), ''),
    unidade_estoque = coalesce(nullif(btrim(p_dados ->> 'unidade_estoque'), ''), 'un'),
    unidade_aplicacao = coalesce(nullif(btrim(p_dados ->> 'unidade_aplicacao'), ''), 'un'),
    fator_conversao = coalesce((p_dados ->> 'fator_conversao')::numeric, 1),
    fracionavel = coalesce((p_dados ->> 'fracionavel')::boolean, false),
    validade_pos_abertura_horas = (p_dados ->> 'validade_pos_abertura_horas')::integer,
    rastreado = coalesce((p_dados ->> 'rastreado')::boolean, false),
    controlado = coalesce((p_dados ->> 'controlado')::boolean, false),
    conselhos_permitidos = coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(p_dados -> 'conselhos_permitidos', '[]'::jsonb)) x), '{}'),
    estoque_minimo = coalesce((p_dados ->> 'estoque_minimo')::numeric, 0),
    ponto_pedido = (p_dados ->> 'ponto_pedido')::numeric,
    gerenciado = coalesce((p_dados ->> 'gerenciado')::boolean, true),
    versao = e.versao + 1,
    updated_by = auth.uid()
   where e.id = v_cfg.id
  returning e.versao into v_versao;
  return jsonb_build_object('id', v_cfg.id, 'versao', v_versao);
end $$;
revoke execute on function public.fn_clinic_estoque_produto_salvar(uuid, uuid, jsonb, integer) from public, anon;
grant  execute on function public.fn_clinic_estoque_produto_salvar(uuid, uuid, jsonb, integer) to authenticated;

create or replace function public.fn_clinic_estoque_local_salvar(p_org uuid, p_local uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := p_local;
  v_resource uuid := nullif(p_dados ->> 'resource_id', '')::uuid;
  v_padrao boolean := coalesce((p_dados ->> 'padrao')::boolean, false);
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.configurar');
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'estoque_dados_invalidos' using errcode = '22023';
  end if;
  if v_resource is not null and not exists (
    select 1 from public.clinic_resources r where r.id = v_resource and r.organization_id = p_org) then
    raise exception 'estoque_dados_invalidos' using errcode = '22023';
  end if;
  if v_padrao then
    update public.clinic_estoque_locais set padrao = false, updated_by = auth.uid()
     where organization_id = p_org and padrao and id is distinct from v_id;
  end if;
  if v_id is null then
    insert into public.clinic_estoque_locais (organization_id, nome, tipo, resource_id, padrao, ativo, created_by, updated_by)
    values (p_org, btrim(p_dados ->> 'nome'), coalesce(p_dados ->> 'tipo', 'central'), v_resource, v_padrao,
            coalesce((p_dados ->> 'ativo')::boolean, true), auth.uid(), auth.uid())
    returning id into v_id;
  else
    update public.clinic_estoque_locais set
      nome = btrim(p_dados ->> 'nome'),
      tipo = coalesce(p_dados ->> 'tipo', tipo),
      resource_id = v_resource,
      padrao = v_padrao,
      ativo = coalesce((p_dados ->> 'ativo')::boolean, ativo),
      updated_by = auth.uid()
     where id = v_id and organization_id = p_org;
    if not found then
      raise exception 'estoque_local_invalido' using errcode = '22023';
    end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.fn_clinic_estoque_local_salvar(uuid, uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_local_salvar(uuid, uuid, jsonb) to authenticated;

-- ─── movimentações ──────────────────────────────────────────────────────────
-- Entrada manual: {product_id, local_id, quantidade, em_unidade_estoque?, lote?,
-- validade?, custo_unitario_cents?, motivo?}. Lote vencido não entra.
create or replace function public.fn_clinic_estoque_entrada(p_org uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product uuid := nullif(p_dados ->> 'product_id', '')::uuid;
  v_local uuid := nullif(p_dados ->> 'local_id', '')::uuid;
  v_validade date := nullif(p_dados ->> 'validade', '')::date;
  v_custo numeric := nullif(p_dados ->> 'custo_unitario_cents', '')::numeric;
  v_qtd numeric := (p_dados ->> 'quantidade')::numeric;
  v_cfg public.clinic_produto_estoque;
  v_lote uuid;
  v_op uuid;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.movimentar');
  perform public.fn_clinic_estoque_local_valido(p_org, v_local);
  v_cfg := public.fn_clinic_estoque_config(p_org, v_product);
  if v_qtd is null or v_qtd <= 0 then
    raise exception 'estoque_quantidade_invalida' using errcode = '22023';
  end if;
  if coalesce((p_dados ->> 'em_unidade_estoque')::boolean, false) then
    v_qtd := v_qtd * v_cfg.fator_conversao;
    v_custo := case when v_custo is null then null else v_custo / v_cfg.fator_conversao end;
  end if;
  if v_validade is not null and v_validade < current_date then
    raise exception 'estoque_lote_vencido' using errcode = '22023';
  end if;
  v_lote := public.fn_clinic_estoque_lote(p_org, v_product, p_dados ->> 'lote', v_validade, v_custo);
  insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, motivo, ator)
  values (p_org, 'entrada', 'manual', nullif(btrim(coalesce(p_dados ->> 'motivo', '')), ''), auth.uid())
  returning id into v_op;
  insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, quantidade, custo_unitario_cents)
  values (p_org, v_op, v_product, v_lote, v_local, round(v_qtd, 3), v_custo);
  return jsonb_build_object('operacao_id', v_op, 'lote_id', v_lote);
end $$;
revoke execute on function public.fn_clinic_estoque_entrada(uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_entrada(uuid, jsonb) to authenticated;

-- Transferência: {lote_id, origem_id, destino_id, quantidade}.
create or replace function public.fn_clinic_estoque_transferir(p_org uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote uuid := nullif(p_dados ->> 'lote_id', '')::uuid;
  v_origem uuid := nullif(p_dados ->> 'origem_id', '')::uuid;
  v_destino uuid := nullif(p_dados ->> 'destino_id', '')::uuid;
  v_qtd numeric := (p_dados ->> 'quantidade')::numeric;
  v_product uuid;
  v_op uuid;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.movimentar');
  v_product := public.fn_clinic_estoque_lote_da_org(p_org, v_lote);
  perform public.fn_clinic_estoque_local_valido(p_org, v_origem);
  perform public.fn_clinic_estoque_local_valido(p_org, v_destino);
  if v_origem = v_destino or v_qtd is null or v_qtd <= 0 then
    raise exception 'estoque_quantidade_invalida' using errcode = '22023';
  end if;
  perform public.fn_clinic_estoque_travar(p_org, array[v_lote]);
  insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, motivo, ator)
  values (p_org, 'transferencia', 'manual', nullif(btrim(coalesce(p_dados ->> 'motivo', '')), ''), auth.uid())
  returning id into v_op;
  insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, quantidade)
  values (p_org, v_op, v_product, v_lote, v_origem, -round(v_qtd, 3)),
         (p_org, v_op, v_product, v_lote, v_destino, round(v_qtd, 3));
  perform public.fn_clinic_estoque_conferir_saldos(p_org, v_op);
  return jsonb_build_object('operacao_id', v_op);
end $$;
revoke execute on function public.fn_clinic_estoque_transferir(uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_transferir(uuid, jsonb) to authenticated;

-- Perda (vencimento, quebra, descarte): {lote_id, local_id, quantidade, motivo}.
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
  perform public.fn_clinic_estoque_travar(p_org, array[v_lote]);
  insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, motivo, ator)
  values (p_org, 'perda', 'manual', left(v_motivo, 300), auth.uid())
  returning id into v_op;
  insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, quantidade)
  values (p_org, v_op, v_product, v_lote, v_local, -round(v_qtd, 3));
  perform public.fn_clinic_estoque_conferir_saldos(p_org, v_op);
  return jsonb_build_object('operacao_id', v_op);
end $$;
revoke execute on function public.fn_clinic_estoque_perda(uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_perda(uuid, jsonb) to authenticated;

-- Ajuste para um saldo contado: {lote_id, local_id, saldo_correto, motivo}.
create or replace function public.fn_clinic_estoque_ajustar(p_org uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote uuid := nullif(p_dados ->> 'lote_id', '')::uuid;
  v_local uuid := nullif(p_dados ->> 'local_id', '')::uuid;
  v_alvo numeric := (p_dados ->> 'saldo_correto')::numeric;
  v_motivo text := nullif(btrim(coalesce(p_dados ->> 'motivo', '')), '');
  v_product uuid;
  v_delta numeric;
  v_op uuid;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.inventariar');
  v_product := public.fn_clinic_estoque_lote_da_org(p_org, v_lote);
  perform public.fn_clinic_estoque_local_valido(p_org, v_local);
  if v_alvo is null or v_alvo < 0 then
    raise exception 'estoque_quantidade_invalida' using errcode = '22023';
  end if;
  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception 'estoque_sem_motivo' using errcode = '22023';
  end if;
  perform public.fn_clinic_estoque_travar(p_org, array[v_lote]);
  v_delta := round(v_alvo, 3) - public.fn_clinic_estoque_saldo(p_org, v_lote, v_local);
  if v_delta = 0 then
    return jsonb_build_object('operacao_id', null, 'diferenca', 0);
  end if;
  insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, motivo, ator)
  values (p_org, 'ajuste', 'manual', left(v_motivo, 300), auth.uid())
  returning id into v_op;
  insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, quantidade)
  values (p_org, v_op, v_product, v_lote, v_local, v_delta);
  return jsonb_build_object('operacao_id', v_op, 'diferenca', v_delta);
end $$;
revoke execute on function public.fn_clinic_estoque_ajustar(uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_ajustar(uuid, jsonb) to authenticated;

-- Estorno: operação nova com as linhas invertidas. Recusa estornar estorno,
-- estornar duas vezes e estorno que deixaria algum saldo negativo (ex.: uma
-- entrada cujo produto já foi usado).
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
  select array_agg(distinct m.lote_id) into v_lotes from public.clinic_estoque_movimentos m
   where m.organization_id = p_org and m.operacao_id = p_operacao;
  perform public.fn_clinic_estoque_travar(p_org, coalesce(v_lotes, '{}'));
  insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, estorna_operacao_id, motivo, ator)
  values (p_org, 'estorno', 'estorno', p_operacao, left(btrim(p_motivo), 300), auth.uid())
  returning id into v_op;
  insert into public.clinic_estoque_movimentos
    (organization_id, operacao_id, product_id, lote_id, local_id, frasco_id, quantidade, custo_unitario_cents,
     atendimento_id, contact_id, profissional_user_id, procedure_id)
  select m.organization_id, v_op, m.product_id, m.lote_id, m.local_id, m.frasco_id, -m.quantidade, m.custo_unitario_cents,
         m.atendimento_id, m.contact_id, m.profissional_user_id, m.procedure_id
    from public.clinic_estoque_movimentos m
   where m.organization_id = p_org and m.operacao_id = p_operacao;
  perform public.fn_clinic_estoque_conferir_saldos(p_org, v_op);
  return jsonb_build_object('operacao_id', v_op);
end $$;
revoke execute on function public.fn_clinic_estoque_estornar(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_estoque_estornar(uuid, uuid, text) to authenticated;
