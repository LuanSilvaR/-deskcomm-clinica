-- ════════════════════════════════════════════════════════════════════════════
-- 9040 · clinic — financeiro: recebimentos e parcelas (FORK, financeiro FN2)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/financeiro/requisitos.md (RF-11 a RF-14).
--
-- Com a opção `clinic.financeiro_avancado` ligada, a comanda fecha por
-- fn_clinic_fin_finalizar (a do núcleo, fn_finalizar_comanda, NÃO muda e
-- continua sendo o caminho com a opção desligada):
--
--   • PAGAMENTO DIVIDIDO: várias formas; a soma tem de bater o total;
--   • forma que passa pela maquininha (Pix/débito/crédito com adquirente):
--     uma CONTA A RECEBER por parcela (`receivable`, pendente, vence D+N) e a
--     TAXA da parcela como saída (`card_fee`), com a competência na data da
--     venda. A taxa é calculada por fn_clinic_fin_calcular (9039) e CONGELADA
--     no pagamento (vigência e % gravados);
--   • dinheiro, transferência, Pix sem maquininha: entra pago na hora (`sale`);
--   • COMISSÃO sobre o LÍQUIDO (padrão; configurável): item × % × (líquido ÷
--     bruto da comanda), arredondada para baixo como a do núcleo.
--
-- Recebimento: o cron `fin-parcelas` dá baixa nas parcelas vencidas (a
-- adquirente deposita sozinha); a baixa manual existe para quem recebe antes.
-- Antecipar: as parcelas previstas de um pagamento viram recebidas hoje, e o
-- custo vai como saída `anticipation`.
-- Estorno: fn_clinic_fin_estornar chama o estorno do núcleo (venda, comissão,
-- ponto, lançamentos `sale`) e contra-lança parcelas, taxas e antecipação.
--
-- Núcleo (aditivo, registrado no UPSTREAM): `financial_entries` ganha
-- `competence_date` e `due_date` (nulas = a `entry_date` de sempre) e o CHECK
-- de `origin` ganha card_fee, receivable e anticipation. Idempotente.

-- ─── núcleo: competência, vencimento e as origens novas ─────────────────────
alter table public.financial_entries add column if not exists competence_date date;
alter table public.financial_entries add column if not exists due_date date;
alter table public.financial_entries drop constraint if exists financial_entries_origin_check;
alter table public.financial_entries add constraint financial_entries_origin_check
  check (origin in ('manual', 'sale', 'reversal', 'recurring', 'card_fee', 'receivable', 'anticipation'));
create index if not exists financial_entries_competencia_idx
  on public.financial_entries (organization_id, competence_date) where competence_date is not null;

-- ─── pagamentos da comanda ──────────────────────────────────────────────────
create table if not exists public.clinic_fin_pagamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete restrict,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  tipo text not null,
  adquirente_id uuid,
  tabela_id uuid,
  modalidade text,
  bandeira text,
  parcelas integer not null default 1,
  bruto_cents bigint not null,
  mdr_pct numeric(7,4),
  mdr_cents bigint not null default 0,
  tarifa_cents bigint not null default 0,
  liquido_cents bigint not null,
  antecipacao_cents bigint not null default 0,
  data_venda date not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint clinic_fin_pagamentos_org_id_key unique (organization_id, id),
  constraint clinic_fin_pagamentos_adquirente_fk foreign key (organization_id, adquirente_id)
    references public.clinic_fin_adquirentes (organization_id, id) on delete restrict,
  constraint clinic_fin_pagamentos_tabela_fk foreign key (organization_id, tabela_id)
    references public.clinic_fin_tabelas (organization_id, id) on delete restrict,
  constraint clinic_fin_pagamentos_valores check (
    bruto_cents > 0 and mdr_cents >= 0 and tarifa_cents >= 0 and antecipacao_cents >= 0
    and liquido_cents = bruto_cents - mdr_cents - tarifa_cents),
  constraint clinic_fin_pagamentos_parcelas check (parcelas between 1 and 24),
  constraint clinic_fin_pagamentos_modalidade check (modalidade is null or modalidade in ('pix', 'debito', 'credito'))
);
create index if not exists clinic_fin_pagamentos_sale_idx on public.clinic_fin_pagamentos (organization_id, sale_id);
create index if not exists clinic_fin_pagamentos_data_idx on public.clinic_fin_pagamentos (organization_id, data_venda);

-- ─── parcelas a receber ─────────────────────────────────────────────────────
create table if not exists public.clinic_fin_parcelas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pagamento_id uuid not null,
  sale_id uuid not null references public.sales(id) on delete restrict,
  n integer not null,
  vencimento date not null,
  bruto_cents bigint not null,
  mdr_cents bigint not null default 0,
  tarifa_cents bigint not null default 0,
  liquido_cents bigint not null,
  antecipacao_cents bigint not null default 0,
  status text not null default 'prevista',
  recebida_em timestamptz,
  entrada_id uuid references public.financial_entries(id) on delete restrict,
  taxa_id uuid references public.financial_entries(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_fin_parcelas_pagamento_fk foreign key (organization_id, pagamento_id)
    references public.clinic_fin_pagamentos (organization_id, id) on delete restrict,
  constraint clinic_fin_parcelas_unica unique (pagamento_id, n),
  constraint clinic_fin_parcelas_status check (status in ('prevista', 'recebida', 'antecipada', 'estornada')),
  constraint clinic_fin_parcelas_valores check (
    bruto_cents > 0 and liquido_cents = bruto_cents - mdr_cents - tarifa_cents and antecipacao_cents >= 0)
);
create index if not exists clinic_fin_parcelas_vencimento_idx
  on public.clinic_fin_parcelas (organization_id, status, vencimento);
drop trigger if exists clinic_fin_parcelas_updated_at on public.clinic_fin_parcelas;
create trigger clinic_fin_parcelas_updated_at before update on public.clinic_fin_parcelas
  for each row execute function public.fn_set_updated_at();

-- Pagamento é histórico: não muda nem sai (só a cascata da exclusão da empresa).
-- A parcela só muda de STATUS (e dos campos que o acompanham), pelas funções.
create or replace function public.fn_clinic_fin_pagamento_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'clinic_fin_pagamentos'
     and new.antecipacao_cents >= old.antecipacao_cents
     and (to_jsonb(new) - 'antecipacao_cents') = (to_jsonb(old) - 'antecipacao_cents') then
    return new;
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'clinic_fin_parcelas'
     and (to_jsonb(new) - array['status', 'recebida_em', 'antecipacao_cents', 'updated_at'])
       = (to_jsonb(old) - array['status', 'recebida_em', 'antecipacao_cents', 'updated_at'])
     and to_jsonb(old) ->> 'status' = 'prevista' then
    return new;
  end if;
  raise exception 'fin_recebimento_imutavel' using errcode = '55000';
end $$;
revoke execute on function public.fn_clinic_fin_pagamento_imutavel() from public, anon, authenticated;
drop trigger if exists trg_clinic_fin_pagamentos_imutavel on public.clinic_fin_pagamentos;
create trigger trg_clinic_fin_pagamentos_imutavel before update or delete on public.clinic_fin_pagamentos
  for each row execute function public.fn_clinic_fin_pagamento_imutavel();
drop trigger if exists trg_clinic_fin_parcelas_imutavel on public.clinic_fin_parcelas;
create trigger trg_clinic_fin_parcelas_imutavel before update or delete on public.clinic_fin_parcelas
  for each row execute function public.fn_clinic_fin_pagamento_imutavel();

do $rls$
declare
  t text;
begin
  foreach t in array array['clinic_fin_pagamentos', 'clinic_fin_parcelas'] loop
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
  execute 'revoke delete, truncate on public.clinic_fin_pagamentos from service_role';
  execute 'revoke delete, truncate on public.clinic_fin_parcelas from service_role';
end
$rls$;

-- ─── configuração do financeiro da clínica ──────────────────────────────────
-- settings.clinic.fin = { comissao_base: 'liquido'|'bruto', margem_minima_pct }
create or replace function public.fn_clinic_fin_config_salvar(p_org uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_atual jsonb;
  v_novo jsonb;
begin
  perform public.fn_clinic_fin_exigir(p_org, 'financeiro.configurar');
  if p_dados is null or jsonb_typeof(p_dados) <> 'object'
     or (p_dados ? 'comissao_base' and p_dados ->> 'comissao_base' not in ('liquido', 'bruto'))
     or (p_dados ? 'margem_minima_pct' and (
           jsonb_typeof(p_dados -> 'margem_minima_pct') <> 'number'
           or (p_dados ->> 'margem_minima_pct')::numeric not between 0 and 95))
     or exists (select 1 from jsonb_object_keys(p_dados) k where k not in ('comissao_base', 'margem_minima_pct')) then
    raise exception 'fin_dados_invalidos' using errcode = '22023';
  end if;
  select coalesce(o.settings -> 'clinic' -> 'fin', '{}'::jsonb) into v_atual
    from public.organizations o where o.id = p_org;
  v_novo := v_atual || p_dados;
  update public.organizations
     set settings = jsonb_set(
           coalesce(settings, '{}'::jsonb), '{clinic}',
           (case when jsonb_typeof(settings -> 'clinic') = 'object' then settings -> 'clinic' else '{}'::jsonb end)
             || jsonb_build_object('fin', v_novo),
           true)
   where id = p_org;
  return v_novo;
end $$;
revoke execute on function public.fn_clinic_fin_config_salvar(uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_fin_config_salvar(uuid, jsonb) to authenticated;

-- Hoje no fuso da clínica (a data da venda e das baixas).
create or replace function public.fn_clinic_fin_hoje(p_org uuid)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (now() at time zone coalesce(nullif(o.timezone, ''), 'America/Sao_Paulo'))::date
    from public.organizations o where o.id = p_org;
$$;
revoke execute on function public.fn_clinic_fin_hoje(uuid) from public, anon, authenticated;

-- ─── FINALIZAR com pagamento dividido, parcelas e taxa ─────────────────────
create or replace function public.fn_clinic_fin_finalizar(
  p_org uuid, p_sale uuid, p_pagamentos jsonb, p_loyalty_points integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.sales%rowtype;
  v_hoje date := public.fn_clinic_fin_hoje(p_org);
  v_total bigint;
  v_soma bigint := 0;
  v_liquido_total bigint := 0;
  v_base text;
  v_plano uuid;
  v_p jsonb;
  v_forma record;
  v_tipo text;
  v_adq uuid;
  v_valor bigint;
  v_parcelas integer;
  v_bandeira text;
  v_calc jsonb;
  v_parc jsonb;
  v_pag uuid;
  v_tabela uuid;
  v_entrada uuid;
  v_taxa uuid;
  v_venc date;
  v_paga boolean;
  v_item record;
  v_primeira_forma uuid;
  v_resumo jsonb := '[]'::jsonb;
begin
  perform public.fn_clinic_fin_exigir(p_org, 'financeiro.lancar');
  if p_pagamentos is null or jsonb_typeof(p_pagamentos) <> 'array'
     or jsonb_array_length(p_pagamentos) not between 1 and 6 then
    raise exception 'fin_pagamentos_invalidos' using errcode = '22023';
  end if;

  select * into v_sale from public.sales where id = p_sale and organization_id = p_org for update;
  if not found then
    raise exception 'comanda_nao_encontrada' using errcode = 'P0002';
  end if;
  if v_sale.status = 'finalized' then
    return jsonb_build_object('sale_id', v_sale.id, 'ja_finalizada', true);
  end if;
  if v_sale.status = 'cancelled' then
    raise exception 'comanda_cancelada' using errcode = '22023';
  end if;

  select coalesce(sum(total_cents), 0) into v_total from public.sale_items where sale_id = p_sale;
  v_total := greatest(v_total - coalesce(v_sale.discount_cents, 0), 0);
  if v_total <= 0 then
    raise exception 'fin_total_zero' using errcode = '22023';
  end if;
  select coalesce(sum((p ->> 'valor_cents')::bigint), 0) into v_soma from jsonb_array_elements(p_pagamentos) p;
  if v_soma <> v_total then
    raise exception 'fin_soma_diferente' using errcode = '22023', detail = format('%s|%s', v_soma, v_total);
  end if;

  select id into v_plano from public.account_plans
   where organization_id = p_org and direction = 'in' and is_active
   order by created_at limit 1;

  for v_p in select * from jsonb_array_elements(p_pagamentos) loop
    v_valor := (v_p ->> 'valor_cents')::bigint;
    v_parcelas := coalesce((v_p ->> 'parcelas')::integer, 1);
    v_bandeira := nullif(v_p ->> 'bandeira', '');
    if v_valor is null or v_valor <= 0 then
      raise exception 'fin_pagamentos_invalidos' using errcode = '22023';
    end if;
    select m.id, m.account_id, x.tipo, x.adquirente_id into v_forma
      from public.payment_methods m
      left join public.clinic_fin_forma_extras x on x.payment_method_id = m.id and x.organization_id = p_org
     where m.id = (v_p ->> 'payment_method_id')::uuid and m.organization_id = p_org and m.is_active;
    if not found then
      raise exception 'forma_de_pagamento_invalida' using errcode = '22023';
    end if;
    if v_forma.account_id is null then
      raise exception 'forma_sem_conta' using errcode = '22023';
    end if;
    v_primeira_forma := coalesce(v_primeira_forma, v_forma.id);
    v_tipo := coalesce(v_forma.tipo, 'outro');
    v_adq := case when v_tipo in ('pix', 'debito', 'credito') then v_forma.adquirente_id end;

    if v_adq is null then
      -- Sem maquininha: entra na hora, inteiro. Só 1x (crediário próprio não é desta fase).
      if v_parcelas <> 1 then
        raise exception 'fin_parcelas_invalidas' using errcode = '22023';
      end if;
      insert into public.clinic_fin_pagamentos (
        organization_id, sale_id, payment_method_id, tipo, parcelas, bruto_cents, liquido_cents, data_venda, created_by)
      values (p_org, p_sale, v_forma.id, v_tipo, 1, v_valor, v_valor, v_hoje, auth.uid())
      returning id into v_pag;
      insert into public.financial_entries
        (organization_id, account_id, account_plan_id, sale_id, direction, amount_cents, currency, description,
         entry_date, competence_date, due_date, status, paid_at, origin, created_by_user_id)
      values (p_org, v_forma.account_id, v_plano, p_sale, 'in', v_valor, v_sale.currency,
              format('Comanda #%s', v_sale.number), v_hoje, v_hoje, v_hoje, 'paid', now(), 'sale', auth.uid());
      v_liquido_total := v_liquido_total + v_valor;
      v_resumo := v_resumo || jsonb_build_object('pagamento_id', v_pag, 'bruto_cents', v_valor, 'liquido_cents', v_valor, 'parcelas', 1);
      continue;
    end if;

    v_calc := public.fn_clinic_fin_calcular(p_org, v_adq, v_tipo, v_bandeira, v_parcelas, v_valor, v_hoje, false, null);
    select t.id into v_tabela from public.clinic_fin_tabelas t
     where t.adquirente_id = v_adq and t.cancelada_em is null and t.vigente_desde = (v_calc ->> 'vigente_desde')::date;

    insert into public.clinic_fin_pagamentos (
      organization_id, sale_id, payment_method_id, tipo, adquirente_id, tabela_id, modalidade, bandeira, parcelas,
      bruto_cents, mdr_pct, mdr_cents, tarifa_cents, liquido_cents, data_venda, created_by)
    values (p_org, p_sale, v_forma.id, v_tipo, v_adq, v_tabela, v_tipo, v_bandeira, v_parcelas,
            v_valor, (v_calc ->> 'mdr_pct')::numeric, (v_calc ->> 'mdr_cents')::bigint, (v_calc ->> 'tarifa_cents')::bigint,
            (v_calc ->> 'liquido_cents')::bigint, v_hoje, auth.uid())
    returning id into v_pag;

    for v_parc in select * from jsonb_array_elements(v_calc -> 'parcelas') loop
      v_venc := (v_parc ->> 'vencimento')::date;
      v_paga := v_venc <= v_hoje;
      insert into public.financial_entries
        (organization_id, account_id, account_plan_id, sale_id, direction, amount_cents, currency, description,
         entry_date, competence_date, due_date, status, paid_at, origin, created_by_user_id)
      values (p_org, v_forma.account_id, v_plano, p_sale, 'in', (v_parc ->> 'bruto_cents')::bigint, v_sale.currency,
              format('Comanda #%s — parcela %s/%s', v_sale.number, v_parc ->> 'n', v_parcelas),
              v_venc, v_hoje, v_venc, case when v_paga then 'paid' else 'pending' end,
              case when v_paga then now() end, 'receivable', auth.uid())
      returning id into v_entrada;
      v_taxa := null;
      if (v_parc ->> 'mdr_cents')::bigint + (v_parc ->> 'tarifa_cents')::bigint > 0 then
        insert into public.financial_entries
          (organization_id, account_id, sale_id, direction, amount_cents, currency, description,
           entry_date, competence_date, due_date, status, paid_at, origin, created_by_user_id)
        values (p_org, v_forma.account_id, p_sale, 'out',
                (v_parc ->> 'mdr_cents')::bigint + (v_parc ->> 'tarifa_cents')::bigint, v_sale.currency,
                format('Taxa da maquininha — comanda #%s, parcela %s/%s', v_sale.number, v_parc ->> 'n', v_parcelas),
                v_venc, v_hoje, v_venc, case when v_paga then 'paid' else 'pending' end,
                case when v_paga then now() end, 'card_fee', auth.uid())
        returning id into v_taxa;
      end if;
      insert into public.clinic_fin_parcelas (
        organization_id, pagamento_id, sale_id, n, vencimento, bruto_cents, mdr_cents, tarifa_cents, liquido_cents,
        status, recebida_em, entrada_id, taxa_id)
      values (p_org, v_pag, p_sale, (v_parc ->> 'n')::integer, v_venc, (v_parc ->> 'bruto_cents')::bigint,
              (v_parc ->> 'mdr_cents')::bigint, (v_parc ->> 'tarifa_cents')::bigint, (v_parc ->> 'liquido_cents')::bigint,
              case when v_paga then 'recebida' else 'prevista' end, case when v_paga then now() end, v_entrada, v_taxa);
    end loop;
    v_liquido_total := v_liquido_total + (v_calc ->> 'liquido_cents')::bigint;
    v_resumo := v_resumo || jsonb_build_object(
      'pagamento_id', v_pag, 'bruto_cents', v_valor, 'liquido_cents', (v_calc ->> 'liquido_cents')::bigint,
      'mdr_pct', (v_calc ->> 'mdr_pct')::numeric, 'parcelas', v_parcelas);
  end loop;

  -- (1) a venda — a forma "principal" é a primeira (o CHECK do núcleo exige uma)
  update public.sales
     set status = 'finalized', finalized_at = now(), payment_method_id = v_primeira_forma, total_cents = v_total
   where id = p_sale;

  -- (2) comissão: sobre o líquido (padrão) ou o bruto, % congelado na inclusão
  v_base := coalesce((select o.settings -> 'clinic' -> 'fin' ->> 'comissao_base' from public.organizations o where o.id = p_org), 'liquido');
  for v_item in
    select * from public.sale_items where sale_id = p_sale and attendant_user_id is not null
  loop
    insert into public.commissions (organization_id, sale_item_id, attendant_user_id, percent, amount_cents)
    values (
      p_org, v_item.id, v_item.attendant_user_id, v_item.commission_percent,
      case when v_base = 'bruto'
           then floor(v_item.total_cents * v_item.commission_percent / 100.0)
           else floor(v_item.total_cents * v_item.commission_percent / 100.0 * v_liquido_total / v_total) end)
    on conflict (sale_item_id) do nothing;
  end loop;

  -- (3) fidelidade e (4) agendamento: os mesmos passos de fn_finalizar_comanda
  if p_loyalty_points > 0 and v_sale.contact_id is not null then
    insert into public.loyalty_ledger
      (organization_id, contact_id, points, reason, sale_id, idempotency_key, created_by_user_id)
    values (p_org, v_sale.contact_id, p_loyalty_points, 'Comanda finalizada', p_sale, format('sale:%s', p_sale), auth.uid())
    on conflict do nothing;
  end if;
  if v_sale.appointment_id is not null then
    update public.calendar_appointments
       set status = 'completed', outcome_recorded_at = now()
     where id = v_sale.appointment_id and organization_id = p_org and status not in ('cancelled', 'no_show');
  end if;

  return jsonb_build_object(
    'sale_id', v_sale.id, 'number', v_sale.number, 'total_cents', v_total,
    'liquido_cents', v_liquido_total, 'comissao_base', v_base, 'pagamentos', v_resumo);
end $$;
revoke execute on function public.fn_clinic_fin_finalizar(uuid, uuid, jsonb, integer) from public, anon;
grant  execute on function public.fn_clinic_fin_finalizar(uuid, uuid, jsonb, integer) to authenticated;

-- ─── baixa de uma parcela (recebida) ────────────────────────────────────────
-- Interna: a manual (fn_clinic_fin_receber_parcela) e o cron chamam.
create or replace function public.fn_clinic_fin_baixar_parcela(
  p_parcela uuid, p_status text, p_data date, p_antecipacao_cents bigint default 0)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.clinic_fin_parcelas;
begin
  select * into v from public.clinic_fin_parcelas where id = p_parcela for update;
  if not found or v.status <> 'prevista' then
    return;
  end if;
  update public.financial_entries
     set status = 'paid', paid_at = now(), entry_date = p_data
   where id in (v.entrada_id, v.taxa_id) and status = 'pending';
  update public.clinic_fin_parcelas
     set status = p_status, recebida_em = now(), antecipacao_cents = coalesce(p_antecipacao_cents, 0)
   where id = p_parcela;
end $$;
revoke execute on function public.fn_clinic_fin_baixar_parcela(uuid, text, date, bigint) from public, anon, authenticated;

create or replace function public.fn_clinic_fin_receber_parcela(p_org uuid, p_parcela uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  -- Sem exigir a opção ligada: parcela já vendida é dinheiro a receber de
  -- verdade, mesmo que a clínica desligue o financeiro depois.
  perform public.fn_acesso_exigir(p_org, 'financeiro.lancar');
  select status into v_status from public.clinic_fin_parcelas where id = p_parcela and organization_id = p_org;
  if not found then
    raise exception 'fin_parcela_invalida' using errcode = 'P0002';
  end if;
  if v_status <> 'prevista' then
    raise exception 'fin_parcela_fechada' using errcode = '22023';
  end if;
  perform public.fn_clinic_fin_baixar_parcela(p_parcela, 'recebida', public.fn_clinic_fin_hoje(p_org));
  return jsonb_build_object('id', p_parcela, 'status', 'recebida');
end $$;
revoke execute on function public.fn_clinic_fin_receber_parcela(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_fin_receber_parcela(uuid, uuid) to authenticated;

-- Cron (service role): as parcelas que venceram, em todas as empresas.
create or replace function public.fn_clinic_fin_baixar_vencidas()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
  n integer := 0;
begin
  for v in
    select p.id, public.fn_clinic_fin_hoje(p.organization_id) as hoje
      from public.clinic_fin_parcelas p
     where p.status = 'prevista'
       and p.vencimento <= public.fn_clinic_fin_hoje(p.organization_id)
     order by p.organization_id, p.vencimento
     limit 5000
  loop
    perform public.fn_clinic_fin_baixar_parcela(v.id, 'recebida', v.hoje);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.fn_clinic_fin_baixar_vencidas() from public, anon, authenticated;
grant  execute on function public.fn_clinic_fin_baixar_vencidas() to service_role;

-- ─── antecipar as parcelas previstas de um pagamento ────────────────────────
-- p_confirmar = false só simula (devolve o custo); true executa.
create or replace function public.fn_clinic_fin_antecipar(p_org uuid, p_pagamento uuid, p_confirmar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pag public.clinic_fin_pagamentos;
  a public.clinic_fin_adquirentes;
  v_hoje date := public.fn_clinic_fin_hoje(p_org);
  v record;
  v_custo bigint;
  v_total bigint := 0;
  v_liquido bigint := 0;
  v_n integer := 0;
  v_conta uuid;
begin
  perform public.fn_acesso_exigir(p_org, case when p_confirmar then 'financeiro.lancar' else 'financeiro.ver' end);
  select * into v_pag from public.clinic_fin_pagamentos where id = p_pagamento and organization_id = p_org
    for update;
  if not found or v_pag.adquirente_id is null then
    raise exception 'fin_pagamento_invalido' using errcode = 'P0002';
  end if;
  select * into a from public.clinic_fin_adquirentes where id = v_pag.adquirente_id;
  select m.account_id into v_conta from public.payment_methods m where m.id = v_pag.payment_method_id;
  for v in
    select * from public.clinic_fin_parcelas
     where pagamento_id = p_pagamento and status = 'prevista' and vencimento > v_hoje
     order by n for update
  loop
    v_custo := 0;
    if a.antecipacao_pct > 0 then
      v_custo := case when a.antecipacao_modo = 'fixa'
                      then round(v.liquido_cents * a.antecipacao_pct / 100)
                      else round(v.liquido_cents * a.antecipacao_pct * (v.vencimento - v_hoje) / 3000) end;
    end if;
    v_total := v_total + v_custo;
    v_liquido := v_liquido + v.liquido_cents - v_custo;
    v_n := v_n + 1;
    if p_confirmar then
      perform public.fn_clinic_fin_baixar_parcela(v.id, 'antecipada', v_hoje, v_custo);
    end if;
  end loop;
  if v_n = 0 then
    raise exception 'fin_nada_a_antecipar' using errcode = '22023';
  end if;
  if p_confirmar then
    if v_total > 0 then
      insert into public.financial_entries
        (organization_id, account_id, sale_id, direction, amount_cents, currency, description,
         entry_date, competence_date, due_date, status, paid_at, origin, created_by_user_id)
      values (p_org, v_conta, v_pag.sale_id, 'out', v_total, 'BRL',
              format('Antecipação de %s parcela(s) — %s', v_n, a.nome), v_hoje, v_hoje, v_hoje, 'paid', now(),
              'anticipation', auth.uid());
    end if;
    update public.clinic_fin_pagamentos set antecipacao_cents = antecipacao_cents + v_total where id = p_pagamento;
  end if;
  return jsonb_build_object('parcelas', v_n, 'custo_cents', v_total, 'liquido_cents', v_liquido, 'confirmado', p_confirmar);
end $$;
revoke execute on function public.fn_clinic_fin_antecipar(uuid, uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_fin_antecipar(uuid, uuid, boolean) to authenticated;

-- ─── ESTORNO: o do núcleo + parcelas, taxas e antecipação ──────────────────
create or replace function public.fn_clinic_fin_estornar(p_org uuid, p_sale uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r jsonb;
  v_orig public.financial_entries;
  v_hoje date := public.fn_clinic_fin_hoje(p_org);
begin
  -- Sem exigir a opção ligada: a venda feita com ela precisa poder ser
  -- estornada inteira mesmo depois de a clínica desligar.
  perform public.fn_acesso_exigir(p_org, 'financeiro.estornar');
  r := public.fn_estornar_comanda(p_org, p_sale, p_motivo);
  if coalesce((r ->> 'ja_estornada')::boolean, false) then
    return r;
  end if;
  -- Pendentes (parcelas que ainda não caíram) viram pagas HOJE e são
  -- contra-lançadas hoje: a conta fecha em zero sem apagar nada.
  update public.financial_entries
     set status = 'paid', paid_at = now(), entry_date = v_hoje
   where sale_id = p_sale and organization_id = p_org
     and origin in ('receivable', 'card_fee') and status = 'pending';
  for v_orig in
    select * from public.financial_entries
     where sale_id = p_sale and organization_id = p_org and origin in ('receivable', 'card_fee', 'anticipation')
       and reverses_entry_id is null
       and not exists (select 1 from public.financial_entries x where x.reverses_entry_id = financial_entries.id)
  loop
    insert into public.financial_entries
      (organization_id, account_id, account_plan_id, sale_id, direction, amount_cents, currency, description,
       entry_date, competence_date, due_date, status, paid_at, origin, reverses_entry_id, created_by_user_id)
    values (p_org, v_orig.account_id, v_orig.account_plan_id, p_sale,
            case when v_orig.direction = 'in' then 'out' else 'in' end, v_orig.amount_cents, v_orig.currency,
            'Estorno: ' || coalesce(v_orig.description, ''), v_hoje, v_hoje, v_hoje, 'paid', now(), 'reversal',
            v_orig.id, auth.uid());
  end loop;
  update public.clinic_fin_parcelas set status = 'estornada'
   where sale_id = p_sale and organization_id = p_org and status = 'prevista';
  return r;
end $$;
revoke execute on function public.fn_clinic_fin_estornar(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_fin_estornar(uuid, uuid, text) to authenticated;

-- ─── custo direto da comanda (para a margem no fechamento) ──────────────────
-- Comissão estimada pela regra atual + insumos consumidos no atendimento do
-- agendamento (custo do lote). Insumos só para quem vê custos do estoque.
create or replace function public.fn_clinic_fin_custo_da_comanda(p_org uuid, p_sale uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.sales;
  v_comissao bigint;
  v_insumos bigint;
begin
  perform public.fn_clinic_fin_exigir(p_org, 'financeiro.lancar');
  select * into v_sale from public.sales where id = p_sale and organization_id = p_org;
  if not found then
    raise exception 'comanda_nao_encontrada' using errcode = 'P0002';
  end if;
  select coalesce(sum(floor(i.total_cents * i.commission_percent / 100.0)), 0)::bigint into v_comissao
    from public.sale_items i where i.sale_id = p_sale and i.attendant_user_id is not null;
  if v_sale.appointment_id is not null and public.fn_has_permission(p_org, 'estoque.custos') then
    select coalesce(round(sum(-m.quantidade * coalesce(m.custo_unitario_cents, 0))), 0)::bigint into v_insumos
      from public.clinic_estoque_movimentos m
      join public.clinic_atendimentos a on a.id = m.atendimento_id and a.organization_id = p_org
     where m.organization_id = p_org and a.appointment_id = v_sale.appointment_id;
  end if;
  return jsonb_build_object('comissao_cents', v_comissao, 'insumos_cents', v_insumos,
                            'insumos_visiveis', v_insumos is not null);
end $$;
revoke execute on function public.fn_clinic_fin_custo_da_comanda(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_fin_custo_da_comanda(uuid, uuid) to authenticated;
