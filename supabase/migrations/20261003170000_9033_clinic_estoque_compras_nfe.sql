-- ════════════════════════════════════════════════════════════════════════════
-- 9033 · clinic — estoque: compras pelo XML da NF-e (FORK, estoque E5)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/estoque/plano.md. Sem SEFAZ/DF-e: a clínica envia o XML
-- (arquivo no Storage privado `clinic-nfe`, só pelas rotas). O app lê a nota
-- (lib/clinic/estoque/nfe/parser.ts), sugere o produto de cada item (EAN →
-- histórico do fornecedor → nome) e grava tudo em CONFERÊNCIA. Ninguém lança
-- sem conferir item a item (produto, fator de conversão, lote e validade).
--
--   clinic_estoque_fornecedores          CNPJ único por empresa
--   clinic_estoque_fornecedor_produtos   de/para aprendido (fornecedor + código
--                                        do fornecedor → produto + fator)
--   clinic_estoque_nfe                   a nota (chave de 44 dígitos ÚNICA por
--                                        empresa), status, arquivo e sha256
--   clinic_estoque_nfe_itens             itens da nota + o que a conferência
--                                        decidiu + a operação de entrada
--
-- Lançar: uma ENTRADA por item (origem = item → idempotente), lote com custo
-- unitário = custo do item (com frete, seguro, IPI, ST − desconto) ÷ quantidade
-- convertida; aprende o de/para; opcionalmente uma conta a pagar PENDENTE em
-- `financial_entries` (origin 'manual', exige `financeiro.lancar`). Lote
-- vencido não entra. Aditiva e idempotente (anexada ao fim do baseline).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinic-nfe', 'clinic-nfe', false, 1048576, array['application/xml', 'text/xml'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.clinic_estoque_fornecedores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cnpj text not null,
  nome text not null,
  created_at timestamptz not null default now(),
  constraint clinic_estoque_fornecedores_org_id_key unique (organization_id, id),
  constraint clinic_estoque_fornecedores_cnpj_unico unique (organization_id, cnpj),
  constraint clinic_estoque_fornecedores_cnpj check (cnpj ~ '^[0-9]{14}$'),
  constraint clinic_estoque_fornecedores_nome check (char_length(btrim(nome)) between 1 and 200)
);

create table if not exists public.clinic_estoque_fornecedor_produtos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fornecedor_id uuid not null,
  codigo text not null,
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  fator numeric(14,3) not null default 1,
  updated_at timestamptz not null default now(),
  constraint clinic_estoque_fornecedor_produtos_unico unique (organization_id, fornecedor_id, codigo),
  constraint clinic_estoque_fornecedor_produtos_fator check (fator > 0),
  constraint clinic_estoque_fornecedor_produtos_codigo check (char_length(codigo) between 1 and 60),
  constraint clinic_estoque_fornecedor_produtos_fornecedor_fk foreign key (organization_id, fornecedor_id)
    references public.clinic_estoque_fornecedores (organization_id, id) on delete cascade
);

create table if not exists public.clinic_estoque_nfe (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  chave text not null,
  numero text not null,
  serie text not null,
  emissao date,
  fornecedor_id uuid,
  emitente_cnpj text,
  emitente_nome text not null,
  destinatario_cnpj text,
  total_cents bigint not null default 0,
  arquivo_path text,
  sha256 text not null,
  status text not null default 'conferencia',
  local_id uuid,
  financial_entry_id uuid references public.financial_entries(id) on delete set null,
  motivo text,
  created_at timestamptz not null default now(),
  created_by uuid,
  lancada_em timestamptz,
  lancada_por uuid,
  constraint clinic_estoque_nfe_org_id_key unique (organization_id, id),
  constraint clinic_estoque_nfe_chave_unica unique (organization_id, chave),
  constraint clinic_estoque_nfe_chave check (chave ~ '^[0-9]{44}$'),
  constraint clinic_estoque_nfe_sha check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint clinic_estoque_nfe_status check (status in ('conferencia', 'lancada', 'cancelada')),
  constraint clinic_estoque_nfe_textos check (
    char_length(numero) <= 20 and char_length(serie) <= 10 and char_length(emitente_nome) <= 200
    and coalesce(char_length(motivo), 0) <= 300),
  constraint clinic_estoque_nfe_fornecedor_fk foreign key (organization_id, fornecedor_id)
    references public.clinic_estoque_fornecedores (organization_id, id),
  constraint clinic_estoque_nfe_local_fk foreign key (organization_id, local_id)
    references public.clinic_estoque_locais (organization_id, id)
);
create index if not exists clinic_estoque_nfe_data_idx on public.clinic_estoque_nfe (organization_id, created_at desc);

create table if not exists public.clinic_estoque_nfe_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nfe_id uuid not null,
  numero integer not null,
  codigo text not null,
  descricao text not null,
  ean text,
  ncm text,
  unidade text not null,
  quantidade numeric(14,4) not null,
  valor_total_cents bigint not null default 0,
  custo_total_cents bigint not null default 0,
  registro_anvisa text,
  rastro jsonb not null default '[]'::jsonb,
  product_id uuid references public.catalog_products(id),
  origem_casamento text,
  fator numeric(14,3),
  lote text,
  validade date,
  ignorado boolean not null default false,
  conferido boolean not null default false,
  operacao_id uuid,
  constraint clinic_estoque_nfe_itens_unico unique (nfe_id, numero),
  constraint clinic_estoque_nfe_itens_origem check (origem_casamento is null
    or origem_casamento in ('ean', 'historico', 'nome', 'ia', 'manual')),
  constraint clinic_estoque_nfe_itens_quantidade check (quantidade > 0),
  constraint clinic_estoque_nfe_itens_fator check (fator is null or fator > 0),
  constraint clinic_estoque_nfe_itens_textos check (
    char_length(codigo) <= 60 and char_length(descricao) <= 200 and char_length(unidade) <= 20
    and coalesce(char_length(lote), 0) <= 60 and coalesce(char_length(registro_anvisa), 0) <= 40),
  constraint clinic_estoque_nfe_itens_rastro check (jsonb_typeof(rastro) = 'array'),
  constraint clinic_estoque_nfe_itens_nfe_fk foreign key (organization_id, nfe_id)
    references public.clinic_estoque_nfe (organization_id, id) on delete cascade,
  constraint clinic_estoque_nfe_itens_operacao_fk foreign key (organization_id, operacao_id)
    references public.clinic_estoque_operacoes (organization_id, id)
);

do $rls$
declare
  t text;
begin
  foreach t in array array['clinic_estoque_fornecedores', 'clinic_estoque_fornecedor_produtos',
                           'clinic_estoque_nfe', 'clinic_estoque_nfe_itens'] loop
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

-- ─── registrar a nota (em conferência) ─────────────────────────────────────
-- p_dados = a nota lida + sugestões por item (product_id, origem, fator, lote,
-- validade) + arquivo_path + sha256. Sugestão de produto de outra empresa vira
-- nula. Chave repetida → estoque_nfe_duplicada.
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
  v_fornecedor uuid;
  v_id uuid;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.compras');
  if v_chave is null or v_chave !~ '^[0-9]{44}$' or jsonb_typeof(p_dados -> 'itens') <> 'array'
     or jsonb_array_length(p_dados -> 'itens') = 0 or jsonb_array_length(p_dados -> 'itens') > 990 then
    raise exception 'estoque_dados_invalidos' using errcode = '22023';
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
          coalesce((p_dados ->> 'total_cents')::bigint, 0), p_dados ->> 'arquivo_path', p_dados ->> 'sha256', auth.uid())
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
         left(nullif(btrim(coalesce(i ->> 'lote', '')), ''), 60),
         nullif(i ->> 'validade', '')::date
    from jsonb_array_elements(p_dados -> 'itens') i
    left join public.catalog_products c
      on c.id = nullif(i ->> 'product_id', '')::uuid and c.organization_id = p_org;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.fn_clinic_estoque_nfe_registrar(uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_nfe_registrar(uuid, jsonb) to authenticated;

-- ─── conferir um item ───────────────────────────────────────────────────────
-- { product_id, fator, lote, validade } ou { ignorar: true } (frete, brinde,
-- item que não é de estoque).
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
  v_lote text := left(nullif(btrim(coalesce(p_dados ->> 'lote', '')), ''), 60);
  v_validade date := nullif(p_dados ->> 'validade', '')::date;
  v_rastreado boolean;
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
  select coalesce(e.rastreado, false) into v_rastreado from public.clinic_produto_estoque e
   where e.organization_id = p_org and e.product_id = v_product;
  if coalesce(v_rastreado, false) and (v_lote is null or v_validade is null) then
    raise exception 'estoque_lote_obrigatorio' using errcode = '22023';
  end if;
  if v_validade is not null and v_validade < current_date then
    raise exception 'estoque_lote_vencido' using errcode = '22023';
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

-- ─── lançar a nota ──────────────────────────────────────────────────────────
-- { local_id, conta_id? }. Todos os itens conferidos.
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
  v_qtd numeric;
  v_custo numeric;
  v_lote uuid;
  v_op uuid;
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
    v_lote := public.fn_clinic_estoque_lote(p_org, v_i.product_id, v_i.lote, v_i.validade, v_custo);
    update public.clinic_estoque_lotes l
       set fornecedor_id = coalesce(l.fornecedor_id, v_nfe.fornecedor_id),
           nfe_item_id = coalesce(l.nfe_item_id, v_i.id),
           custo_unitario_cents = coalesce(l.custo_unitario_cents, v_custo)
     where l.id = v_lote;
    insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, origem_id, motivo, ator)
    values (p_org, 'entrada', 'nfe_item', v_i.id, left('NF-e ' || v_nfe.numero || ' — ' || v_nfe.emitente_nome, 300), auth.uid())
    returning id into v_op;
    insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, quantidade, custo_unitario_cents)
    values (p_org, v_op, v_i.product_id, v_lote, v_local, v_qtd, v_custo);
    update public.clinic_estoque_nfe_itens set operacao_id = v_op where id = v_i.id;
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

-- ─── cancelar (só em conferência) ──────────────────────────────────────────
create or replace function public.fn_clinic_estoque_nfe_cancelar(p_org uuid, p_nfe uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.compras');
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'estoque_sem_motivo' using errcode = '22023';
  end if;
  select n.status into v_status from public.clinic_estoque_nfe n where n.id = p_nfe and n.organization_id = p_org for update;
  if v_status is null then
    raise exception 'estoque_nfe_invalida' using errcode = 'P0002';
  end if;
  if v_status <> 'conferencia' then
    raise exception 'estoque_nfe_fechada' using errcode = '22023';
  end if;
  update public.clinic_estoque_nfe set status = 'cancelada', motivo = left(btrim(p_motivo), 300) where id = p_nfe;
  return jsonb_build_object('status', 'cancelada');
end $$;
revoke execute on function public.fn_clinic_estoque_nfe_cancelar(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_estoque_nfe_cancelar(uuid, uuid, text) to authenticated;
