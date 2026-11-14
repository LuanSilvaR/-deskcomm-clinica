-- ════════════════════════════════════════════════════════════════════════════
-- 8007 · clinic — orçamento O2: orçamento em rascunho (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/orcamento/plano.md (fase O2). Depende da 8006 (preços).
--
--   clinic_orcamentos       o orçamento do paciente: número sequencial por
--                           empresa, versão, status, totais, desconto, condição
--                           de pagamento (5 formas) e validade.
--   clinic_orcamento_itens  as linhas: o preço vem da VIGÊNCIA da tabela de
--                           preços (nunca do corpo da requisição) e a
--                           descrição fica congelada.
--
-- Regras no BANCO:
--   • escreve só fn_clinic_orcamento_* (permissão + opção + MFA); authenticated
--     só LÊ, e com orcamentos.ver. Sem texto clínico;
--   • itens só mudam enquanto o orçamento é RASCUNHO (trigger); orçamento não se
--     apaga (DELETE só na cascata da exclusão da empresa) — cancela-se;
--   • desconto acima do limite (settings.clinic.orcamentos_desconto_max_pct,
--     padrão 10%) fica PENDENTE até alguém com orcamentos.aprovar_desconto
--     aprovar; quem tem a permissão aprova ao salvar;
--   • condição de pagamento: dinheiro, pix, debito, credito (à vista) ou
--     parcelado (cartão, 2–24×, entrada opcional em dinheiro/pix/débito). O valor
--     das parcelas é calculado aqui; o centavo que sobra vai na 1ª.
-- Aditiva, idempotente, sem HTTP. Envio/contrato ficam para a O3.

-- ─── orçamentos ─────────────────────────────────────────────────────────────
create table if not exists public.clinic_orcamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id),
  atendimento_id uuid,
  profissional_user_id uuid references auth.users(id) on delete set null,
  numero integer not null,
  versao integer not null default 1,
  substitui_id uuid,
  status text not null default 'rascunho',
  subtotal_cents bigint not null default 0,
  desconto_cents bigint not null default 0,
  total_cents bigint not null default 0,
  desconto_pendente boolean not null default false,
  desconto_aprovado_por uuid references auth.users(id) on delete set null,
  desconto_aprovado_em timestamptz,
  condicao_pagamento jsonb not null default '{"forma": "pix", "parcelas": 1}'::jsonb,
  validade_ate date not null,
  observacao text,
  cancelado_em timestamptz,
  cancelado_por uuid references auth.users(id) on delete set null,
  motivo_cancelamento text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint clinic_orcamentos_org_id_key unique (organization_id, id),
  constraint clinic_orcamentos_numero_key unique (organization_id, numero, versao),
  constraint clinic_orcamentos_atendimento_fk foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id),
  constraint clinic_orcamentos_substitui_fk foreign key (organization_id, substitui_id)
    references public.clinic_orcamentos (organization_id, id),
  constraint clinic_orcamentos_status check (
    status in ('rascunho', 'enviado', 'aprovado', 'recusado', 'expirado', 'cancelado', 'substituido')),
  constraint clinic_orcamentos_valores check (
    subtotal_cents between 0 and 1000000000 and desconto_cents between 0 and subtotal_cents
    and total_cents = subtotal_cents - desconto_cents),
  constraint clinic_orcamentos_numero check (numero >= 1 and versao >= 1),
  constraint clinic_orcamentos_observacao check (observacao is null or char_length(observacao) <= 500),
  constraint clinic_orcamentos_cancelado check ((status = 'cancelado') = (cancelado_em is not null))
);
create index if not exists clinic_orcamentos_paciente_idx
  on public.clinic_orcamentos (organization_id, contact_id, created_at desc);
create index if not exists clinic_orcamentos_atendimento_idx
  on public.clinic_orcamentos (organization_id, atendimento_id) where atendimento_id is not null;

-- ─── itens ──────────────────────────────────────────────────────────────────
create table if not exists public.clinic_orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  orcamento_id uuid not null,
  preco_id uuid not null,
  procedure_id uuid,
  event_type_id uuid,
  descricao text not null,
  sessoes integer not null,
  quantidade integer not null default 1,
  preco_unit_cents bigint not null,
  total_cents bigint not null,
  posicao integer not null default 0,
  created_at timestamptz not null default now(),
  constraint clinic_orcamento_itens_orcamento_fk foreign key (organization_id, orcamento_id)
    references public.clinic_orcamentos (organization_id, id) on delete cascade,
  constraint clinic_orcamento_itens_preco_fk foreign key (organization_id, preco_id)
    references public.clinic_precos (organization_id, id),
  constraint clinic_orcamento_itens_quantidade check (quantidade between 1 and 50 and sessoes between 1 and 100),
  constraint clinic_orcamento_itens_valores check (preco_unit_cents >= 0 and total_cents = preco_unit_cents * quantidade),
  constraint clinic_orcamento_itens_descricao check (char_length(descricao) between 1 and 200)
);
create index if not exists clinic_orcamento_itens_orcamento_idx
  on public.clinic_orcamento_itens (organization_id, orcamento_id, posicao);

-- Orçamento não se apaga (só na cascata da empresa); itens só mudam em rascunho.
create or replace function public.fn_clinic_orcamento_guarda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if tg_table_name = 'clinic_orcamentos' then
    raise exception 'orcamento_imutavel' using errcode = '55000';
  end if;
  select o.status into v_status
    from public.clinic_orcamentos o
   where o.organization_id = coalesce(new.organization_id, old.organization_id)
     and o.id = coalesce(new.orcamento_id, old.orcamento_id);
  if v_status is distinct from 'rascunho' then
    raise exception 'orcamento_nao_editavel' using errcode = '55000';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.fn_clinic_orcamento_guarda() from public, anon, authenticated;
drop trigger if exists trg_clinic_orcamentos_guarda on public.clinic_orcamentos;
create trigger trg_clinic_orcamentos_guarda before delete on public.clinic_orcamentos
  for each row execute function public.fn_clinic_orcamento_guarda();
drop trigger if exists trg_clinic_orcamento_itens_guarda on public.clinic_orcamento_itens;
create trigger trg_clinic_orcamento_itens_guarda before insert or update or delete on public.clinic_orcamento_itens
  for each row execute function public.fn_clinic_orcamento_guarda();

-- ─── RLS: membro lê com orcamentos.ver; ninguém escreve direto ──────────────
do $rls$
declare
  t text;
begin
  foreach t in array array['clinic_orcamentos', 'clinic_orcamento_itens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format($p$create policy tenant_isolation_%s_all on public.%I
        using ((organization_id in (select public.fn_user_org_ids()))
               and public.fn_role_at_least(organization_id, 'viewer'))
        with check ((organization_id in (select public.fn_user_org_ids()))
               and public.fn_role_at_least(organization_id, 'viewer'))$p$, t, t);
    execute format('drop policy if exists acesso_ler on public.%I', t);
    execute format($p$create policy acesso_ler on public.%I as restrictive for select
                      using (public.fn_has_permission(organization_id, 'orcamentos.ver'))$p$, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end
$rls$;

-- ─── permissões ─────────────────────────────────────────────────────────────
insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao, clinica) values
  ('orcamentos.criar', 'orcamentos', 'criar', 'agent', array['orcamentos.ver']::text[], false, 'Montar e editar orçamentos em rascunho', false),
  ('orcamentos.aprovar_desconto', 'orcamentos', 'aprovar_desconto', 'manager', array['orcamentos.ver']::text[], false, 'Aprovar desconto acima do limite da clínica', false),
  ('orcamentos.cancelar', 'orcamentos', 'cancelar', 'manager', array['orcamentos.ver']::text[], false, 'Cancelar orçamento', false)
on conflict (key) do update
  set modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
      depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao,
      clinica = excluded.clinica;

insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
select r.organization_id, r.id, p.key
  from public.clinic_roles r
  join public.clinic_permissions p on p.modulo = 'orcamentos'
 where r.system_key = 'administrador'
    or (r.system_key = 'gerente' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('manager'))
    or (r.system_key = 'atendente' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('agent'))
    or (r.system_key = 'visualizador' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('viewer'))
on conflict do nothing;

-- ─── limite de desconto (settings.clinic.orcamentos_desconto_max_pct) ───────
create or replace function public.fn_clinic_orcamento_desconto_max(p_org uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select case when jsonb_typeof(o.settings -> 'clinic' -> 'orcamentos_desconto_max_pct') = 'number'
                 then (o.settings -> 'clinic' ->> 'orcamentos_desconto_max_pct')::numeric end
       from public.organizations o where o.id = p_org),
    10);
$$;
revoke execute on function public.fn_clinic_orcamento_desconto_max(uuid) from public, anon, authenticated;

create or replace function public.fn_clinic_definir_orcamentos_desconto_max(p_org uuid, p_pct numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes numeric;
begin
  if auth.uid() is null
     or p_org is null
     or p_pct is null
     or p_pct < 0 or p_pct > 100
     or not public.fn_role_at_least(p_org, 'admin')
     or not public.fn_support_write_allowed(p_org) then
    raise exception 'clinic_flag_forbidden' using errcode = '42501';
  end if;
  if not public.fn_session_mfa_proven() then
    raise exception 'clinic_flag_mfa_required' using errcode = '42501';
  end if;
  v_antes := public.fn_clinic_orcamento_desconto_max(p_org);
  update public.organizations
     set settings = jsonb_set(
           coalesce(settings, '{}'::jsonb),
           '{clinic}',
           (case when jsonb_typeof(settings -> 'clinic') = 'object' then settings -> 'clinic' else '{}'::jsonb end)
             || jsonb_build_object('orcamentos_desconto_max_pct', round(p_pct, 2)),
           true)
   where id = p_org;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('pct', round(p_pct, 2), 'mudou', v_antes <> round(p_pct, 2));
end $$;
revoke execute on function public.fn_clinic_definir_orcamentos_desconto_max(uuid, numeric) from public, anon;
grant  execute on function public.fn_clinic_definir_orcamentos_desconto_max(uuid, numeric) to authenticated;

-- ─── condição de pagamento: valida e calcula as parcelas ────────────────────
-- Entrada: {forma, parcelas?, entrada?: {valor_cents, forma}, observacao?}.
-- Saída normalizada com valor_parcela_cents e primeira_parcela_cents.
create or replace function public.fn_clinic_orcamento_condicao(p_condicao jsonb, p_total bigint)
returns jsonb
language plpgsql
immutable
security definer
set search_path = public, pg_temp
as $$
declare
  v_forma text;
  v_parcelas integer;
  v_entrada bigint := 0;
  v_entrada_forma text;
  v_obs text;
  v_resto bigint;
  v_parcela bigint;
begin
  if p_condicao is null or jsonb_typeof(p_condicao) <> 'object' then
    raise exception 'orcamento_pagamento_invalido' using errcode = '22023';
  end if;
  begin
    v_forma := p_condicao ->> 'forma';
    v_parcelas := coalesce(nullif(p_condicao ->> 'parcelas', '')::integer, 1);
    if jsonb_typeof(p_condicao -> 'entrada') = 'object' then
      v_entrada := coalesce(nullif(p_condicao -> 'entrada' ->> 'valor_cents', '')::bigint, 0);
      v_entrada_forma := p_condicao -> 'entrada' ->> 'forma';
    end if;
  exception when others then
    raise exception 'orcamento_pagamento_invalido' using errcode = '22023';
  end;
  v_obs := nullif(btrim(coalesce(p_condicao ->> 'observacao', '')), '');
  if v_forma is null or v_forma not in ('dinheiro', 'pix', 'debito', 'credito', 'parcelado')
     or (v_obs is not null and char_length(v_obs) > 200) then
    raise exception 'orcamento_pagamento_invalido' using errcode = '22023';
  end if;
  if v_forma = 'parcelado' then
    if v_parcelas not between 2 and 24 then
      raise exception 'orcamento_pagamento_invalido' using errcode = '22023';
    end if;
    if v_entrada <> 0 and (v_entrada < 0 or v_entrada >= p_total
                           or v_entrada_forma is null or v_entrada_forma not in ('dinheiro', 'pix', 'debito')) then
      raise exception 'orcamento_pagamento_invalido' using errcode = '22023';
    end if;
  else
    if v_parcelas <> 1 or v_entrada <> 0 then
      raise exception 'orcamento_pagamento_invalido' using errcode = '22023';
    end if;
  end if;
  v_resto := p_total - v_entrada;
  v_parcela := v_resto / v_parcelas;
  return jsonb_strip_nulls(jsonb_build_object(
    'forma', v_forma,
    'parcelas', v_parcelas,
    'entrada', case when v_entrada > 0 then jsonb_build_object('valor_cents', v_entrada, 'forma', v_entrada_forma) end,
    'valor_parcela_cents', v_parcela,
    'primeira_parcela_cents', v_parcela + (v_resto - v_parcela * v_parcelas),
    'observacao', v_obs));
end $$;
revoke execute on function public.fn_clinic_orcamento_condicao(jsonb, bigint) from public, anon, authenticated;

-- ─── salvar (cria ou edita o rascunho) ──────────────────────────────────────
-- p_dados: {contact_id, atendimento_id?, profissional_user_id?, itens: [{preco_id,
-- quantidade?}], desconto_cents?, condicao_pagamento, validade_ate?, observacao?}.
-- O preço e a descrição de cada item vêm da vigência ATUAL da tabela de preços.
create or replace function public.fn_clinic_orcamento_salvar(p_org uuid, p_id uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := p_id;
  v_atual public.clinic_orcamentos;
  v_contact uuid;
  v_atend uuid;
  v_prof uuid;
  v_desconto bigint;
  v_validade date;
  v_obs text;
  v_item jsonb;
  v_preco public.clinic_precos;
  v_nome text;
  v_qtd integer;
  v_pos integer := 0;
  v_subtotal bigint := 0;
  v_total bigint;
  v_condicao jsonb;
  v_numero integer;
  v_max numeric;
  v_pendente boolean;
  v_pode_aprovar boolean;
begin
  perform public.fn_clinic_orcamentos_exigir(p_org, 'orcamentos.criar');
  if p_dados is null or jsonb_typeof(p_dados) <> 'object'
     or jsonb_typeof(p_dados -> 'itens') is distinct from 'array'
     or jsonb_array_length(p_dados -> 'itens') not between 1 and 50 then
    raise exception 'orcamento_dados_invalidos' using errcode = '22023';
  end if;
  begin
    v_contact := nullif(p_dados ->> 'contact_id', '')::uuid;
    v_atend := nullif(p_dados ->> 'atendimento_id', '')::uuid;
    v_prof := coalesce(nullif(p_dados ->> 'profissional_user_id', '')::uuid, auth.uid());
    v_desconto := coalesce(nullif(p_dados ->> 'desconto_cents', '')::bigint, 0);
    v_validade := coalesce(nullif(p_dados ->> 'validade_ate', '')::date, current_date + 15);
  exception when others then
    raise exception 'orcamento_dados_invalidos' using errcode = '22023';
  end;
  v_obs := nullif(btrim(coalesce(p_dados ->> 'observacao', '')), '');
  if v_validade < current_date or v_validade > current_date + 365
     or (v_obs is not null and char_length(v_obs) > 500) then
    raise exception 'orcamento_dados_invalidos' using errcode = '22023';
  end if;

  if v_id is not null then
    select * into v_atual from public.clinic_orcamentos o
     where o.organization_id = p_org and o.id = v_id
     for update;
    if not found then
      raise exception 'orcamento_invalido' using errcode = '22023';
    end if;
    if v_atual.status <> 'rascunho' then
      raise exception 'orcamento_nao_editavel' using errcode = '55000';
    end if;
    v_contact := v_atual.contact_id; -- o paciente do orçamento não muda
  end if;

  if v_contact is null or not exists (
    select 1 from public.contacts c where c.id = v_contact and c.organization_id = p_org) then
    raise exception 'orcamento_paciente_invalido' using errcode = '22023';
  end if;
  if v_atend is not null and not exists (
    select 1 from public.clinic_atendimentos a
     where a.organization_id = p_org and a.id = v_atend and a.contact_id = v_contact and a.status <> 'anulado') then
    raise exception 'orcamento_atendimento_invalido' using errcode = '22023';
  end if;
  if v_prof is not null and not exists (
    select 1 from public.user_organizations u where u.user_id = v_prof and u.organization_id = p_org) then
    raise exception 'orcamento_dados_invalidos' using errcode = '22023';
  end if;

  if v_id is null then
    perform pg_advisory_xact_lock(hashtextextended('clinic_orcamento_numero:' || p_org, 0));
    select coalesce(max(o.numero), 0) + 1 into v_numero from public.clinic_orcamentos o where o.organization_id = p_org;
    insert into public.clinic_orcamentos (organization_id, contact_id, numero, validade_ate, created_by, updated_by)
    values (p_org, v_contact, v_numero, v_validade, auth.uid(), auth.uid())
    returning id into v_id;
  else
    delete from public.clinic_orcamento_itens i where i.organization_id = p_org and i.orcamento_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_dados -> 'itens') loop
    v_preco := null;
    v_nome := null;
    begin
      v_qtd := coalesce(nullif(v_item ->> 'quantidade', '')::integer, 1);
      select p.* into v_preco
        from public.clinic_precos p
       where p.organization_id = p_org and p.id = nullif(v_item ->> 'preco_id', '')::uuid;
    exception when others then
      raise exception 'orcamento_dados_invalidos' using errcode = '22023';
    end;
    -- só a vigência ATUAL e ativa do item vale (a tabela pode ter mudado)
    if v_preco.id is null or not v_preco.ativo or v_preco.vigente_desde > now() or exists (
      select 1 from public.clinic_precos n
       where n.organization_id = p_org
         and coalesce(n.procedure_id, n.event_type_id) = coalesce(v_preco.procedure_id, v_preco.event_type_id)
         and n.sessoes = v_preco.sessoes
         and n.vigente_desde <= now()
         and (n.vigente_desde, n.created_at, n.id) > (v_preco.vigente_desde, v_preco.created_at, v_preco.id)) then
      raise exception 'orcamento_preco_desatualizado' using errcode = '22023';
    end if;
    if v_qtd not between 1 and 50 then
      raise exception 'orcamento_dados_invalidos' using errcode = '22023';
    end if;
    if v_preco.procedure_id is not null then
      select c.name into v_nome from public.clinic_procedures c where c.organization_id = p_org and c.id = v_preco.procedure_id;
    else
      select e.name into v_nome from public.calendar_event_types e where e.organization_id = p_org and e.id = v_preco.event_type_id;
    end if;
    v_nome := left(coalesce(v_preco.descricao,
                            coalesce(v_nome, 'Item') || case when v_preco.sessoes > 1 then ' — ' || v_preco.sessoes || ' sessões' else '' end), 200);
    v_pos := v_pos + 1;
    insert into public.clinic_orcamento_itens (organization_id, orcamento_id, preco_id, procedure_id, event_type_id,
                                               descricao, sessoes, quantidade, preco_unit_cents, total_cents, posicao)
    values (p_org, v_id, v_preco.id, v_preco.procedure_id, v_preco.event_type_id,
            v_nome, v_preco.sessoes, v_qtd, v_preco.preco_cents, v_preco.preco_cents * v_qtd, v_pos);
    v_subtotal := v_subtotal + v_preco.preco_cents * v_qtd;
  end loop;

  if v_desconto < 0 or v_desconto > v_subtotal then
    raise exception 'orcamento_desconto_invalido' using errcode = '22023';
  end if;
  v_total := v_subtotal - v_desconto;
  v_condicao := public.fn_clinic_orcamento_condicao(
    coalesce(p_dados -> 'condicao_pagamento', '{"forma": "pix"}'::jsonb), v_total);

  v_max := public.fn_clinic_orcamento_desconto_max(p_org);
  v_pendente := v_desconto > 0 and v_subtotal > 0 and (v_desconto * 100.0 / v_subtotal) > v_max;
  v_pode_aprovar := public.fn_has_permission(p_org, 'orcamentos.aprovar_desconto');

  update public.clinic_orcamentos set
    atendimento_id = v_atend,
    profissional_user_id = v_prof,
    subtotal_cents = v_subtotal,
    desconto_cents = v_desconto,
    total_cents = v_total,
    desconto_pendente = v_pendente and not v_pode_aprovar,
    desconto_aprovado_por = case when v_pendente and v_pode_aprovar then auth.uid() end,
    desconto_aprovado_em = case when v_pendente and v_pode_aprovar then now() end,
    condicao_pagamento = v_condicao,
    validade_ate = v_validade,
    observacao = v_obs,
    updated_by = auth.uid(),
    updated_at = now()
   where organization_id = p_org and id = v_id
  returning numero into v_numero;

  return jsonb_build_object('id', v_id, 'numero', v_numero, 'total_cents', v_total,
                            'desconto_pendente', v_pendente and not v_pode_aprovar);
end $$;
revoke execute on function public.fn_clinic_orcamento_salvar(uuid, uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_orcamento_salvar(uuid, uuid, jsonb) to authenticated;

-- ─── aprovar o desconto pendente ────────────────────────────────────────────
create or replace function public.fn_clinic_orcamento_aprovar_desconto(p_org uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_clinic_orcamentos_exigir(p_org, 'orcamentos.aprovar_desconto');
  update public.clinic_orcamentos set
    desconto_pendente = false,
    desconto_aprovado_por = auth.uid(),
    desconto_aprovado_em = now(),
    updated_by = auth.uid(),
    updated_at = now()
   where organization_id = p_org and id = p_id and status = 'rascunho' and desconto_pendente;
  if not found then
    raise exception 'orcamento_nao_editavel' using errcode = '55000';
  end if;
  return jsonb_build_object('id', p_id);
end $$;
revoke execute on function public.fn_clinic_orcamento_aprovar_desconto(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_orcamento_aprovar_desconto(uuid, uuid) to authenticated;

-- ─── cancelar (na O2: só rascunho) ──────────────────────────────────────────
create or replace function public.fn_clinic_orcamento_cancelar(p_org uuid, p_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform public.fn_clinic_orcamentos_exigir(p_org, 'orcamentos.cancelar');
  if v_motivo is null or char_length(v_motivo) not between 3 and 300 then
    raise exception 'orcamento_sem_motivo' using errcode = '22023';
  end if;
  update public.clinic_orcamentos set
    status = 'cancelado',
    cancelado_em = now(),
    cancelado_por = auth.uid(),
    motivo_cancelamento = v_motivo,
    updated_by = auth.uid(),
    updated_at = now()
   where organization_id = p_org and id = p_id and status = 'rascunho';
  if not found then
    raise exception 'orcamento_nao_editavel' using errcode = '55000';
  end if;
  return jsonb_build_object('id', p_id);
end $$;
revoke execute on function public.fn_clinic_orcamento_cancelar(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_orcamento_cancelar(uuid, uuid, text) to authenticated;
