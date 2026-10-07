-- ════════════════════════════════════════════════════════════════════════════
-- 9039 · clinic — financeiro: motor de taxas de maquininha (FORK, financeiro FN1)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/financeiro/requisitos.md.
--
--   clinic_fin_adquirentes   a maquininha contratada (prazos D+N, tarifa fixa,
--                            taxa de antecipação)
--   clinic_fin_tabelas       uma VIGÊNCIA da tabela de taxas da adquirente
--   clinic_fin_taxas         as linhas: modalidade × faixa de parcelas ×
--                            bandeira (nula = todas) → MDR %
--   clinic_fin_forma_extras  o tipo da forma de pagamento (pix, débito,
--                            crédito…) e a adquirente dela — 1:1 com
--                            payment_methods, a tabela do núcleo não muda
--
-- Regras no BANCO:
--   • a taxa NUNCA muda o passado: tabela e linhas são imutáveis; editar é
--     publicar uma vigência nova (de hoje em diante). Só uma vigência FUTURA,
--     que ainda não valeu, pode ser cancelada para dar lugar a outra;
--   • fn_clinic_fin_calcular é o espelho exato de lib/clinic/financeiro/taxas.ts
--     (mesma régua de arredondamento e rateio; teste de paridade);
--   • escrita só por funções (permissão financeiro.taxas + opção ligada);
--     authenticated só LÊ, e com financeiro.ver.
-- A opção nasce desligada: settings.clinic.financeiro_avancado. Idempotente.

-- ─── adquirentes ────────────────────────────────────────────────────────────
create table if not exists public.clinic_fin_adquirentes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null,
  modelo text,
  prazo_pix_dias integer not null default 0,
  prazo_debito_dias integer not null default 1,
  prazo_credito_dias integer not null default 30,
  tarifa_fixa_cents bigint not null default 0,
  antecipacao_pct numeric(7,4) not null default 0,
  antecipacao_modo text not null default 'por_mes',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint clinic_fin_adquirentes_org_id_key unique (organization_id, id),
  constraint clinic_fin_adquirentes_nome check (char_length(btrim(nome)) between 1 and 80),
  constraint clinic_fin_adquirentes_modelo check (modelo is null or modelo in ('ton', 'cielo_smart', 'mercado_pago')),
  constraint clinic_fin_adquirentes_prazos check (
    prazo_pix_dias between 0 and 400 and prazo_debito_dias between 0 and 400 and prazo_credito_dias between 0 and 400),
  constraint clinic_fin_adquirentes_tarifa check (tarifa_fixa_cents between 0 and 100000),
  constraint clinic_fin_adquirentes_antecipacao check (antecipacao_pct >= 0 and antecipacao_pct <= 100),
  constraint clinic_fin_adquirentes_antecipacao_modo check (antecipacao_modo in ('por_mes', 'fixa'))
);
create unique index if not exists clinic_fin_adquirentes_nome_unico
  on public.clinic_fin_adquirentes (organization_id, lower(btrim(nome)));
drop trigger if exists clinic_fin_adquirentes_updated_at on public.clinic_fin_adquirentes;
create trigger clinic_fin_adquirentes_updated_at before update on public.clinic_fin_adquirentes
  for each row execute function public.fn_set_updated_at();

-- ─── vigências da tabela de taxas ───────────────────────────────────────────
create table if not exists public.clinic_fin_tabelas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  adquirente_id uuid not null,
  vigente_desde date not null,
  cancelada_em timestamptz,
  cancelada_por uuid,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint clinic_fin_tabelas_org_id_key unique (organization_id, id),
  constraint clinic_fin_tabelas_adquirente_fk foreign key (organization_id, adquirente_id)
    references public.clinic_fin_adquirentes (organization_id, id) on delete cascade
);
create unique index if not exists clinic_fin_tabelas_vigencia_unica
  on public.clinic_fin_tabelas (adquirente_id, vigente_desde) where cancelada_em is null;

-- ─── linhas da tabela ───────────────────────────────────────────────────────
create table if not exists public.clinic_fin_taxas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tabela_id uuid not null,
  bandeira text,
  modalidade text not null,
  parcelas_de integer not null,
  parcelas_ate integer not null,
  mdr_pct numeric(7,4) not null,
  constraint clinic_fin_taxas_tabela_fk foreign key (organization_id, tabela_id)
    references public.clinic_fin_tabelas (organization_id, id) on delete cascade,
  constraint clinic_fin_taxas_bandeira check (
    bandeira is null or bandeira in ('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outras')),
  constraint clinic_fin_taxas_modalidade check (modalidade in ('pix', 'debito', 'credito')),
  constraint clinic_fin_taxas_parcelas check (
    parcelas_de between 1 and 24 and parcelas_ate between parcelas_de and 24
    and (modalidade = 'credito' or (parcelas_de = 1 and parcelas_ate = 1))),
  constraint clinic_fin_taxas_mdr check (mdr_pct >= 0 and mdr_pct <= 100)
);
create unique index if not exists clinic_fin_taxas_linha_unica
  on public.clinic_fin_taxas (tabela_id, coalesce(bandeira, '*'), modalidade, parcelas_de, parcelas_ate);

-- ─── tipo e adquirente da forma de pagamento ────────────────────────────────
create table if not exists public.clinic_fin_forma_extras (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id) on delete cascade,
  tipo text not null,
  adquirente_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint clinic_fin_forma_extras_unica unique (organization_id, payment_method_id),
  constraint clinic_fin_forma_extras_adquirente_fk foreign key (organization_id, adquirente_id)
    references public.clinic_fin_adquirentes (organization_id, id) on delete restrict,
  constraint clinic_fin_forma_extras_tipo check (
    tipo in ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'outro'))
);
drop trigger if exists clinic_fin_forma_extras_updated_at on public.clinic_fin_forma_extras;
create trigger clinic_fin_forma_extras_updated_at before update on public.clinic_fin_forma_extras
  for each row execute function public.fn_set_updated_at();

-- ─── imutabilidade: a taxa nunca muda o passado ────────────────────────────
-- Linhas: nada muda nem sai (só a cascata da exclusão da empresa, profundidade
-- > 1). Vigência: só pode ganhar `cancelada_em` enquanto ainda é FUTURA.
create or replace function public.fn_clinic_fin_taxa_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'clinic_fin_tabelas'
     and old.cancelada_em is null and new.cancelada_em is not null
     and old.vigente_desde > current_date
     and new.id = old.id and new.organization_id = old.organization_id
     and new.adquirente_id = old.adquirente_id and new.vigente_desde = old.vigente_desde
     and new.created_at = old.created_at and new.created_by is not distinct from old.created_by then
    return new;
  end if;
  raise exception 'fin_taxa_imutavel' using errcode = '55000';
end $$;
revoke execute on function public.fn_clinic_fin_taxa_imutavel() from public, anon, authenticated;
drop trigger if exists trg_clinic_fin_tabelas_imutavel on public.clinic_fin_tabelas;
create trigger trg_clinic_fin_tabelas_imutavel before update or delete on public.clinic_fin_tabelas
  for each row execute function public.fn_clinic_fin_taxa_imutavel();
drop trigger if exists trg_clinic_fin_taxas_imutavel on public.clinic_fin_taxas;
create trigger trg_clinic_fin_taxas_imutavel before update or delete on public.clinic_fin_taxas
  for each row execute function public.fn_clinic_fin_taxa_imutavel();

-- ─── RLS: membro lê com financeiro.ver; ninguém escreve direto ──────────────
do $rls$
declare
  t text;
begin
  foreach t in array array[
    'clinic_fin_adquirentes', 'clinic_fin_tabelas', 'clinic_fin_taxas', 'clinic_fin_forma_extras'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format($p$create policy tenant_isolation_%s_all on public.%I
        using ((organization_id in (select public.fn_user_org_ids()))
               and public.fn_role_at_least(organization_id, 'viewer'))
        with check ((organization_id in (select public.fn_user_org_ids()))
               and public.fn_role_at_least(organization_id, 'viewer'))$p$, t, t);
    execute format('drop policy if exists acesso_ler on public.%I', t);
    execute format($p$create policy acesso_ler on public.%I as restrictive for select
                      using (public.fn_has_permission(organization_id, 'financeiro.ver'))$p$, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
  execute 'revoke update, delete, truncate on public.clinic_fin_taxas from service_role';
end
$rls$;

-- ─── permissão ──────────────────────────────────────────────────────────────
insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao, clinica) values
  ('financeiro.taxas', 'financeiro', 'taxas', 'manager', array['financeiro.ver']::text[], false,
   'Configurar maquininhas: adquirentes, taxas e prazos', false)
on conflict (key) do update
  set modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
      depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao,
      clinica = excluded.clinica;

insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
select r.organization_id, r.id, 'financeiro.taxas'
  from public.clinic_roles r
 where r.system_key in ('administrador', 'gerente')
on conflict do nothing;

-- ─── a opção: settings.clinic.financeiro_avancado (nasce desligada) ────────
create or replace function public.fn_clinic_definir_financeiro_avancado(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'financeiro_avancado') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('financeiro_avancado', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;
revoke execute on function public.fn_clinic_definir_financeiro_avancado(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_financeiro_avancado(uuid, boolean) to authenticated;

-- Permissão + opção ligada. Interna.
create or replace function public.fn_clinic_fin_exigir(p_org uuid, p_permissao text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_acesso_exigir(p_org, p_permissao);
  if not coalesce((select (o.settings -> 'clinic' -> 'financeiro_avancado') = 'true'::jsonb
                     from public.organizations o where o.id = p_org), false) then
    raise exception 'financeiro_avancado_desligado' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.fn_clinic_fin_exigir(uuid, text) from public, anon, authenticated;

-- ─── salvar adquirente ──────────────────────────────────────────────────────
create or replace function public.fn_clinic_fin_adquirente_salvar(p_org uuid, p_adquirente uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := p_adquirente;
begin
  perform public.fn_clinic_fin_exigir(p_org, 'financeiro.taxas');
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'fin_dados_invalidos' using errcode = '22023';
  end if;
  if v_id is null then
    insert into public.clinic_fin_adquirentes (
      organization_id, nome, modelo, prazo_pix_dias, prazo_debito_dias, prazo_credito_dias,
      tarifa_fixa_cents, antecipacao_pct, antecipacao_modo, ativo, created_by, updated_by)
    values (
      p_org, btrim(p_dados ->> 'nome'), nullif(p_dados ->> 'modelo', ''),
      coalesce((p_dados ->> 'prazo_pix_dias')::integer, 0),
      coalesce((p_dados ->> 'prazo_debito_dias')::integer, 1),
      coalesce((p_dados ->> 'prazo_credito_dias')::integer, 30),
      coalesce((p_dados ->> 'tarifa_fixa_cents')::bigint, 0),
      coalesce((p_dados ->> 'antecipacao_pct')::numeric, 0),
      coalesce(p_dados ->> 'antecipacao_modo', 'por_mes'),
      coalesce((p_dados ->> 'ativo')::boolean, true),
      auth.uid(), auth.uid())
    returning id into v_id;
  else
    update public.clinic_fin_adquirentes a set
      nome = coalesce(btrim(p_dados ->> 'nome'), a.nome),
      prazo_pix_dias = coalesce((p_dados ->> 'prazo_pix_dias')::integer, a.prazo_pix_dias),
      prazo_debito_dias = coalesce((p_dados ->> 'prazo_debito_dias')::integer, a.prazo_debito_dias),
      prazo_credito_dias = coalesce((p_dados ->> 'prazo_credito_dias')::integer, a.prazo_credito_dias),
      tarifa_fixa_cents = coalesce((p_dados ->> 'tarifa_fixa_cents')::bigint, a.tarifa_fixa_cents),
      antecipacao_pct = coalesce((p_dados ->> 'antecipacao_pct')::numeric, a.antecipacao_pct),
      antecipacao_modo = coalesce(p_dados ->> 'antecipacao_modo', a.antecipacao_modo),
      ativo = coalesce((p_dados ->> 'ativo')::boolean, a.ativo),
      updated_by = auth.uid()
     where a.id = v_id and a.organization_id = p_org;
    if not found then
      raise exception 'fin_adquirente_invalida' using errcode = '22023';
    end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.fn_clinic_fin_adquirente_salvar(uuid, uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_fin_adquirente_salvar(uuid, uuid, jsonb) to authenticated;

-- ─── publicar uma vigência da tabela de taxas ───────────────────────────────
-- A primeira tabela da adquirente pode valer desde qualquer data; as seguintes
-- só de hoje em diante. Publicar de novo numa data FUTURA já publicada cancela
-- a anterior (ela nunca valeu). Uma data que já valeu não se reescreve.
create or replace function public.fn_clinic_fin_tabela_publicar(
  p_org uuid, p_adquirente uuid, p_vigente_desde date, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_anterior uuid;
  v_n integer;
begin
  perform public.fn_clinic_fin_exigir(p_org, 'financeiro.taxas');
  if p_vigente_desde is null or p_linhas is null or jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'fin_dados_invalidos' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_linhas);
  if v_n < 1 or v_n > 200 then
    raise exception 'fin_dados_invalidos' using errcode = '22023';
  end if;
  perform 1 from public.clinic_fin_adquirentes a
   where a.id = p_adquirente and a.organization_id = p_org
   for update;
  if not found then
    raise exception 'fin_adquirente_invalida' using errcode = '22023';
  end if;
  if p_vigente_desde < current_date and exists (
    select 1 from public.clinic_fin_tabelas t
     where t.adquirente_id = p_adquirente and t.cancelada_em is null) then
    raise exception 'fin_vigencia_no_passado' using errcode = '22023';
  end if;
  select t.id into v_anterior
    from public.clinic_fin_tabelas t
   where t.adquirente_id = p_adquirente and t.vigente_desde = p_vigente_desde and t.cancelada_em is null;
  if v_anterior is not null then
    if p_vigente_desde <= current_date then
      raise exception 'fin_vigencia_existente' using errcode = '23505';
    end if;
    update public.clinic_fin_tabelas set cancelada_em = now(), cancelada_por = auth.uid() where id = v_anterior;
  end if;

  insert into public.clinic_fin_tabelas (organization_id, adquirente_id, vigente_desde, created_by)
  values (p_org, p_adquirente, p_vigente_desde, auth.uid())
  returning id into v_id;

  insert into public.clinic_fin_taxas (organization_id, tabela_id, bandeira, modalidade, parcelas_de, parcelas_ate, mdr_pct)
  select p_org, v_id, nullif(l ->> 'bandeira', ''), l ->> 'modalidade',
         (l ->> 'parcelas_de')::integer, (l ->> 'parcelas_ate')::integer, (l ->> 'mdr_pct')::numeric
    from jsonb_array_elements(p_linhas) l;

  return jsonb_build_object('id', v_id, 'substituiu', v_anterior);
end $$;
revoke execute on function public.fn_clinic_fin_tabela_publicar(uuid, uuid, date, jsonb) from public, anon;
grant  execute on function public.fn_clinic_fin_tabela_publicar(uuid, uuid, date, jsonb) to authenticated;

-- ─── tipo e adquirente de uma forma de pagamento ────────────────────────────
create or replace function public.fn_clinic_fin_forma_salvar(
  p_org uuid, p_payment_method uuid, p_tipo text, p_adquirente uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  perform public.fn_clinic_fin_exigir(p_org, 'financeiro.taxas');
  if not exists (select 1 from public.payment_methods m where m.id = p_payment_method and m.organization_id = p_org) then
    raise exception 'fin_forma_invalida' using errcode = '22023';
  end if;
  if p_adquirente is not null and not exists (
    select 1 from public.clinic_fin_adquirentes a where a.id = p_adquirente and a.organization_id = p_org) then
    raise exception 'fin_adquirente_invalida' using errcode = '22023';
  end if;
  if p_tipo not in ('pix', 'debito', 'credito') and p_adquirente is not null then
    raise exception 'fin_dados_invalidos' using errcode = '22023';
  end if;
  insert into public.clinic_fin_forma_extras (organization_id, payment_method_id, tipo, adquirente_id, created_by, updated_by)
  values (p_org, p_payment_method, p_tipo, p_adquirente, auth.uid(), auth.uid())
  on conflict (organization_id, payment_method_id) do update
    set tipo = excluded.tipo, adquirente_id = excluded.adquirente_id, updated_by = auth.uid()
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.fn_clinic_fin_forma_salvar(uuid, uuid, text, uuid) from public, anon;
grant  execute on function public.fn_clinic_fin_forma_salvar(uuid, uuid, text, uuid) to authenticated;

-- ─── o cálculo (espelho de lib/clinic/financeiro/taxas.ts) ──────────────────
-- Interno: quem grava (a finalização da comanda, FN2) chama; a tela simula no
-- TS com as mesmas tabelas. Devolve as mesmas chaves do `Recebimento` do TS.
create or replace function public.fn_clinic_fin_calcular(
  p_org uuid, p_adquirente uuid, p_modalidade text, p_bandeira text, p_parcelas integer,
  p_bruto_cents bigint, p_data date, p_antecipar boolean default false, p_data_antecipacao date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  a public.clinic_fin_adquirentes;
  v_tabela uuid;
  v_vigente date;
  v_mdr_pct numeric;
  v_mdr bigint;
  v_tarifa bigint;
  v_base_b bigint;
  v_base_m bigint;
  v_b bigint;
  v_m bigint;
  v_t bigint;
  v_l bigint;
  v_a bigint;
  v_dias integer;
  v_venc date;
  v_liq bigint := 0;
  v_ant bigint := 0;
  v_parcelas jsonb := '[]'::jsonb;
  v_data_ant date := coalesce(p_data_antecipacao, p_data);
  i integer;
begin
  if p_bruto_cents is null or p_bruto_cents <= 0 or p_data is null then
    raise exception 'fin_valor_invalido' using errcode = '22023';
  end if;
  if p_parcelas is null or p_parcelas < 1 or p_parcelas > 24
     or p_modalidade is null or p_modalidade not in ('pix', 'debito', 'credito')
     or (p_modalidade <> 'credito' and p_parcelas <> 1) then
    raise exception 'fin_parcelas_invalidas' using errcode = '22023';
  end if;
  select * into a from public.clinic_fin_adquirentes x where x.id = p_adquirente and x.organization_id = p_org;
  if not found then
    raise exception 'fin_adquirente_invalida' using errcode = '22023';
  end if;

  select t.id, t.vigente_desde into v_tabela, v_vigente
    from public.clinic_fin_tabelas t
   where t.adquirente_id = a.id and t.cancelada_em is null and t.vigente_desde <= p_data
   order by t.vigente_desde desc
   limit 1;
  if v_tabela is not null then
    select x.mdr_pct into v_mdr_pct
      from public.clinic_fin_taxas x
     where x.tabela_id = v_tabela
       and x.modalidade = p_modalidade
       and p_parcelas between x.parcelas_de and x.parcelas_ate
       and (x.bandeira is null or x.bandeira = p_bandeira)
     order by (x.bandeira is null), (x.parcelas_ate - x.parcelas_de), x.parcelas_de
     limit 1;
  end if;
  if v_mdr_pct is null then
    raise exception 'fin_taxa_ausente' using errcode = '22023';
  end if;

  v_mdr := round(p_bruto_cents * v_mdr_pct / 100);
  v_tarifa := a.tarifa_fixa_cents;
  if v_mdr + v_tarifa > p_bruto_cents then
    raise exception 'fin_taxa_maior_que_valor' using errcode = '22023';
  end if;

  v_base_b := p_bruto_cents / p_parcelas;
  v_base_m := v_mdr / p_parcelas;
  for i in 1..p_parcelas loop
    v_b := v_base_b + case when i = 1 then p_bruto_cents - v_base_b * p_parcelas else 0 end;
    v_m := v_base_m + case when i = 1 then v_mdr - v_base_m * p_parcelas else 0 end;
    v_t := case when i = 1 then v_tarifa else 0 end;
    v_l := v_b - v_m - v_t;
    v_venc := p_data + case p_modalidade
                         when 'pix' then a.prazo_pix_dias
                         when 'debito' then a.prazo_debito_dias
                         else a.prazo_credito_dias + 30 * (i - 1) end;
    v_dias := v_venc - v_data_ant;
    v_a := 0;
    if coalesce(p_antecipar, false) and v_dias > 0 and v_l > 0 and a.antecipacao_pct > 0 then
      if a.antecipacao_modo = 'fixa' then
        v_a := round(v_l * a.antecipacao_pct / 100);
      else
        v_a := round(v_l * a.antecipacao_pct * v_dias / 3000);
      end if;
    end if;
    v_liq := v_liq + v_l;
    v_ant := v_ant + v_a;
    v_parcelas := v_parcelas || jsonb_build_object(
      'n', i, 'vencimento', to_char(v_venc, 'YYYY-MM-DD'), 'bruto_cents', v_b, 'mdr_cents', v_m,
      'tarifa_cents', v_t, 'liquido_cents', v_l, 'antecipacao_cents', v_a, 'liquido_antecipado_cents', v_l - v_a);
  end loop;

  return jsonb_build_object(
    'mdr_pct', v_mdr_pct,
    'vigente_desde', to_char(v_vigente, 'YYYY-MM-DD'),
    'bruto_cents', p_bruto_cents,
    'mdr_cents', v_mdr,
    'tarifa_cents', v_tarifa,
    'taxa_cents', v_mdr + v_tarifa,
    'liquido_cents', v_liq,
    'antecipacao_cents', v_ant,
    'liquido_antecipado_cents', v_liq - v_ant,
    'custo_total_cents', v_mdr + v_tarifa + v_ant,
    'custo_total_pct', round((v_mdr + v_tarifa + v_ant) * 100.0 / p_bruto_cents, 2),
    'parcelas', v_parcelas);
end $$;
revoke execute on function public.fn_clinic_fin_calcular(uuid, uuid, text, text, integer, bigint, date, boolean, date)
  from public, anon, authenticated;
