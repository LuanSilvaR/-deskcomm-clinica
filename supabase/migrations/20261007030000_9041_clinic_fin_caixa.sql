-- ════════════════════════════════════════════════════════════════════════════
-- 9041 · clinic — financeiro: caixa diário (FORK, financeiro FN3)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/financeiro/requisitos.md (RF-15).
--
--   clinic_fin_caixas            uma SESSÃO de caixa numa conta (gaveta):
--                                abertura com fundo de troco, fechamento com
--                                contagem, diferença e dupla conferência
--   clinic_fin_caixa_movimentos  suprimento (entra dinheiro de fora), sangria
--                                (sai para o banco/cofre) e caixa pequeno
--                                (despesa miúda paga da gaveta)
--
-- Regras no BANCO:
--   • uma sessão aberta por conta;
--   • FUNDO DE TROCO, SUPRIMENTO e SANGRIA não são receita nem despesa: são
--     dinheiro mudando de lugar, e por isso não viram lançamento; o CAIXA
--     PEQUENO é despesa de verdade e vira saída paga, com o plano de contas;
--   • ESPERADO = fundo + lançamentos pagos na conta durante a sessão
--     (entradas − saídas, o caixa pequeno incluso) + suprimentos − sangrias;
--   • fechar exige a contagem; diferença ≠ 0 ou valor contado acima do limite
--     da clínica (settings.clinic.fin.limite_conferencia_cents, padrão
--     R$ 5.000) exige a CONFERÊNCIA de outra pessoa com financeiro.conferir;
--   • a diferença confirmada vira lançamento (`cash`: sobra entra, falta sai);
--   • sessão fechada e movimentos não se alteram.
-- Idempotente.

alter table public.financial_entries drop constraint if exists financial_entries_origin_check;
alter table public.financial_entries add constraint financial_entries_origin_check
  check (origin in ('manual', 'sale', 'reversal', 'recurring', 'card_fee', 'receivable', 'anticipation', 'cash'));

create table if not exists public.clinic_fin_caixas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  status text not null default 'aberto',
  aberto_em timestamptz not null default now(),
  aberto_por uuid not null,
  fundo_troco_cents bigint not null default 0,
  fechado_em timestamptz,
  fechado_por uuid,
  esperado_cents bigint,
  contado_cents bigint,
  diferenca_cents bigint,
  contagem jsonb,
  observacao text,
  conferido_em timestamptz,
  conferido_por uuid,
  diferenca_entry_id uuid references public.financial_entries(id) on delete restrict,
  constraint clinic_fin_caixas_org_id_key unique (organization_id, id),
  constraint clinic_fin_caixas_status check (status in ('aberto', 'aguardando_conferencia', 'fechado')),
  constraint clinic_fin_caixas_valores check (
    fundo_troco_cents >= 0 and (contado_cents is null or contado_cents >= 0)),
  constraint clinic_fin_caixas_observacao check (observacao is null or char_length(observacao) <= 500),
  constraint clinic_fin_caixas_conferencia check (conferido_por is null or conferido_por <> fechado_por)
);
create unique index if not exists clinic_fin_caixas_um_aberto
  on public.clinic_fin_caixas (account_id) where status <> 'fechado';
create index if not exists clinic_fin_caixas_data_idx on public.clinic_fin_caixas (organization_id, aberto_em desc);

create table if not exists public.clinic_fin_caixa_movimentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  caixa_id uuid not null,
  tipo text not null,
  valor_cents bigint not null,
  descricao text not null,
  account_plan_id uuid references public.account_plans(id) on delete restrict,
  financial_entry_id uuid references public.financial_entries(id) on delete restrict,
  criado_em timestamptz not null default now(),
  criado_por uuid not null,
  constraint clinic_fin_caixa_movimentos_caixa_fk foreign key (organization_id, caixa_id)
    references public.clinic_fin_caixas (organization_id, id) on delete cascade,
  constraint clinic_fin_caixa_movimentos_tipo check (tipo in ('suprimento', 'sangria', 'caixa_pequeno')),
  constraint clinic_fin_caixa_movimentos_valor check (valor_cents > 0),
  constraint clinic_fin_caixa_movimentos_descricao check (char_length(btrim(descricao)) between 2 and 200)
);
create index if not exists clinic_fin_caixa_movimentos_caixa_idx on public.clinic_fin_caixa_movimentos (caixa_id);

-- Movimento não muda nem sai; sessão só anda para a frente, pelas funções.
create or replace function public.fn_clinic_fin_caixa_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'clinic_fin_caixas' and old.status <> 'fechado'
     and coalesce(current_setting('clinic.fin_caixa', true), '') = 'on' then
    return new;
  end if;
  raise exception 'fin_caixa_imutavel' using errcode = '55000';
end $$;
revoke execute on function public.fn_clinic_fin_caixa_imutavel() from public, anon, authenticated;
drop trigger if exists trg_clinic_fin_caixas_imutavel on public.clinic_fin_caixas;
create trigger trg_clinic_fin_caixas_imutavel before update or delete on public.clinic_fin_caixas
  for each row execute function public.fn_clinic_fin_caixa_imutavel();
drop trigger if exists trg_clinic_fin_caixa_movimentos_imutavel on public.clinic_fin_caixa_movimentos;
create trigger trg_clinic_fin_caixa_movimentos_imutavel before update or delete on public.clinic_fin_caixa_movimentos
  for each row execute function public.fn_clinic_fin_caixa_imutavel();

do $rls$
declare
  t text;
begin
  foreach t in array array['clinic_fin_caixas', 'clinic_fin_caixa_movimentos'] loop
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
  execute 'revoke update, delete, truncate on public.clinic_fin_caixa_movimentos from service_role';
end
$rls$;

-- ─── permissões ─────────────────────────────────────────────────────────────
insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao, clinica) values
  ('financeiro.caixa', 'financeiro', 'caixa', 'agent', array['financeiro.ver']::text[], false,
   'Abrir e fechar o caixa, suprimento, sangria e caixa pequeno', false),
  ('financeiro.conferir', 'financeiro', 'conferir', 'manager', array['financeiro.ver']::text[], false,
   'Conferir o fechamento de caixa de outra pessoa (dupla conferência)', false)
on conflict (key) do update
  set modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
      depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao,
      clinica = excluded.clinica;

insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
select r.organization_id, r.id, p.key
  from public.clinic_roles r
  join public.clinic_permissions p on p.key in ('financeiro.caixa', 'financeiro.conferir')
 where r.system_key = 'administrador'
    or (r.system_key = 'gerente' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('manager'))
    or (r.system_key = 'atendente' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('agent'))
on conflict do nothing;

-- ─── peças internas ─────────────────────────────────────────────────────────
-- O esperado da gaveta agora (ou no instante p_ate).
create or replace function public.fn_clinic_fin_caixa_esperado(p_caixa uuid, p_ate timestamptz)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.fundo_troco_cents
       + coalesce((select sum(case when e.direction = 'in' then e.amount_cents else -e.amount_cents end)
                     from public.financial_entries e
                    where e.organization_id = c.organization_id and e.account_id = c.account_id
                      and e.status = 'paid' and e.paid_at >= c.aberto_em and e.paid_at <= p_ate), 0)
       + coalesce((select sum(case m.tipo when 'suprimento' then m.valor_cents when 'sangria' then -m.valor_cents else 0 end)
                     from public.clinic_fin_caixa_movimentos m where m.caixa_id = c.id), 0)
    from public.clinic_fin_caixas c where c.id = p_caixa;
$$;
revoke execute on function public.fn_clinic_fin_caixa_esperado(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.fn_clinic_fin_caixa_aberto(p_org uuid, p_caixa uuid)
returns public.clinic_fin_caixas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.clinic_fin_caixas;
begin
  select * into c from public.clinic_fin_caixas where id = p_caixa and organization_id = p_org for update;
  if not found then
    raise exception 'fin_caixa_invalido' using errcode = 'P0002';
  end if;
  return c;
end $$;
revoke execute on function public.fn_clinic_fin_caixa_aberto(uuid, uuid) from public, anon, authenticated;

-- Fecha de vez: grava a diferença como lançamento (`cash`) e encerra.
create or replace function public.fn_clinic_fin_caixa_encerrar(p_caixa uuid, p_conferente uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.clinic_fin_caixas;
  v_entry uuid;
begin
  select * into c from public.clinic_fin_caixas where id = p_caixa;
  if c.diferenca_cents <> 0 then
    insert into public.financial_entries
      (organization_id, account_id, direction, amount_cents, currency, description, entry_date, competence_date,
       due_date, status, paid_at, origin, created_by_user_id)
    values (c.organization_id, c.account_id, case when c.diferenca_cents > 0 then 'in' else 'out' end,
            abs(c.diferenca_cents), 'BRL',
            case when c.diferenca_cents > 0 then 'Sobra de caixa' else 'Falta de caixa' end,
            public.fn_clinic_fin_hoje(c.organization_id), public.fn_clinic_fin_hoje(c.organization_id),
            public.fn_clinic_fin_hoje(c.organization_id), 'paid', c.fechado_em, 'cash', coalesce(p_conferente, c.fechado_por))
    returning id into v_entry;
  end if;
  perform set_config('clinic.fin_caixa', 'on', true);
  update public.clinic_fin_caixas
     set status = 'fechado', conferido_em = case when p_conferente is not null then now() end,
         conferido_por = p_conferente, diferenca_entry_id = v_entry
   where id = p_caixa;
  perform set_config('clinic.fin_caixa', '', true);
end $$;
revoke execute on function public.fn_clinic_fin_caixa_encerrar(uuid, uuid) from public, anon, authenticated;

-- O esperado agora, para a tela (só sessões da própria org; financeiro.ver).
create or replace function public.fn_clinic_fin_caixa_esperado_agora(p_org uuid, p_caixa uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_acesso_exigir(p_org, 'financeiro.ver');
  if not exists (select 1 from public.clinic_fin_caixas c where c.id = p_caixa and c.organization_id = p_org) then
    raise exception 'fin_caixa_invalido' using errcode = 'P0002';
  end if;
  return public.fn_clinic_fin_caixa_esperado(p_caixa, now());
end $$;
revoke execute on function public.fn_clinic_fin_caixa_esperado_agora(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_fin_caixa_esperado_agora(uuid, uuid) to authenticated;

-- ─── abrir ──────────────────────────────────────────────────────────────────
create or replace function public.fn_clinic_fin_caixa_abrir(p_org uuid, p_conta uuid, p_fundo_troco_cents bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  perform public.fn_clinic_fin_exigir(p_org, 'financeiro.caixa');
  if p_fundo_troco_cents is null or p_fundo_troco_cents < 0 or p_fundo_troco_cents > 10000000 then
    raise exception 'fin_dados_invalidos' using errcode = '22023';
  end if;
  perform 1 from public.financial_accounts a where a.id = p_conta and a.organization_id = p_org and a.is_active for update;
  if not found then
    raise exception 'fin_conta_invalida' using errcode = '22023';
  end if;
  if exists (select 1 from public.clinic_fin_caixas c where c.account_id = p_conta and c.status <> 'fechado') then
    raise exception 'fin_caixa_ja_aberto' using errcode = '23505';
  end if;
  insert into public.clinic_fin_caixas (organization_id, account_id, aberto_por, fundo_troco_cents)
  values (p_org, p_conta, auth.uid(), p_fundo_troco_cents)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.fn_clinic_fin_caixa_abrir(uuid, uuid, bigint) from public, anon;
grant  execute on function public.fn_clinic_fin_caixa_abrir(uuid, uuid, bigint) to authenticated;

-- ─── suprimento, sangria, caixa pequeno ─────────────────────────────────────
create or replace function public.fn_clinic_fin_caixa_movimentar(
  p_org uuid, p_caixa uuid, p_tipo text, p_valor_cents bigint, p_descricao text, p_plano uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.clinic_fin_caixas;
  v_entry uuid;
  v_id uuid;
begin
  perform public.fn_clinic_fin_exigir(p_org, 'financeiro.caixa');
  c := public.fn_clinic_fin_caixa_aberto(p_org, p_caixa);
  if c.status <> 'aberto' then
    raise exception 'fin_caixa_fechado' using errcode = '22023';
  end if;
  if p_tipo not in ('suprimento', 'sangria', 'caixa_pequeno') or p_valor_cents is null or p_valor_cents <= 0 then
    raise exception 'fin_dados_invalidos' using errcode = '22023';
  end if;
  if p_tipo <> 'caixa_pequeno' and p_plano is not null then
    raise exception 'fin_dados_invalidos' using errcode = '22023';
  end if;
  if p_plano is not null and not exists (
    select 1 from public.account_plans a where a.id = p_plano and a.organization_id = p_org and a.direction = 'out') then
    raise exception 'fin_plano_invalido' using errcode = '22023';
  end if;
  if p_tipo in ('sangria', 'caixa_pequeno')
     and public.fn_clinic_fin_caixa_esperado(c.id, now()) < p_valor_cents then
    raise exception 'fin_caixa_sem_saldo' using errcode = '22023';
  end if;
  if p_tipo = 'caixa_pequeno' then
    insert into public.financial_entries
      (organization_id, account_id, account_plan_id, direction, amount_cents, currency, description, entry_date,
       competence_date, due_date, status, paid_at, origin, created_by_user_id)
    values (p_org, c.account_id, p_plano, 'out', p_valor_cents, 'BRL', 'Caixa pequeno: ' || btrim(p_descricao),
            public.fn_clinic_fin_hoje(p_org), public.fn_clinic_fin_hoje(p_org), public.fn_clinic_fin_hoje(p_org),
            'paid', now(), 'cash', auth.uid())
    returning id into v_entry;
  end if;
  insert into public.clinic_fin_caixa_movimentos
    (organization_id, caixa_id, tipo, valor_cents, descricao, account_plan_id, financial_entry_id, criado_por)
  values (p_org, c.id, p_tipo, p_valor_cents, btrim(p_descricao), p_plano, v_entry, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'esperado_cents', public.fn_clinic_fin_caixa_esperado(c.id, now()));
end $$;
revoke execute on function public.fn_clinic_fin_caixa_movimentar(uuid, uuid, text, bigint, text, uuid) from public, anon;
grant  execute on function public.fn_clinic_fin_caixa_movimentar(uuid, uuid, text, bigint, text, uuid) to authenticated;

-- ─── fechar (contagem) ──────────────────────────────────────────────────────
-- p_contagem: {"20000": 3, "5000": 2, …} — valor da cédula/moeda em centavos →
-- quantidade. O contado é a soma; a contagem fica guardada para a conferência.
create or replace function public.fn_clinic_fin_caixa_fechar(p_org uuid, p_caixa uuid, p_contagem jsonb, p_observacao text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.clinic_fin_caixas;
  v_contado bigint;
  v_esperado bigint;
  v_limite bigint;
  v_agora timestamptz := now();
  v_precisa boolean;
begin
  perform public.fn_clinic_fin_exigir(p_org, 'financeiro.caixa');
  c := public.fn_clinic_fin_caixa_aberto(p_org, p_caixa);
  if c.status <> 'aberto' then
    raise exception 'fin_caixa_fechado' using errcode = '22023';
  end if;
  if p_contagem is null or jsonb_typeof(p_contagem) <> 'object'
     or exists (select 1 from jsonb_each(p_contagem) x
                 where x.key !~ '^[0-9]{1,6}$' or jsonb_typeof(x.value) <> 'number'
                    or (x.value)::text !~ '^[0-9]{1,5}$') then
    raise exception 'fin_contagem_invalida' using errcode = '22023';
  end if;
  select coalesce(sum(x.key::bigint * (x.value)::text::bigint), 0) into v_contado from jsonb_each(p_contagem) x;
  v_esperado := public.fn_clinic_fin_caixa_esperado(c.id, v_agora);
  v_limite := coalesce((select (o.settings -> 'clinic' -> 'fin' ->> 'limite_conferencia_cents')::bigint
                          from public.organizations o where o.id = p_org), 500000);
  v_precisa := v_contado <> v_esperado or v_contado >= v_limite;
  perform set_config('clinic.fin_caixa', 'on', true);
  update public.clinic_fin_caixas
     set status = case when v_precisa then 'aguardando_conferencia' else status end,
         fechado_em = v_agora, fechado_por = auth.uid(), esperado_cents = v_esperado, contado_cents = v_contado,
         diferenca_cents = v_contado - v_esperado, contagem = p_contagem,
         observacao = nullif(btrim(coalesce(p_observacao, '')), '')
   where id = c.id;
  perform set_config('clinic.fin_caixa', '', true);
  if not v_precisa then
    perform public.fn_clinic_fin_caixa_encerrar(c.id, null);
  end if;
  return jsonb_build_object('id', c.id, 'esperado_cents', v_esperado, 'contado_cents', v_contado,
                            'diferenca_cents', v_contado - v_esperado, 'precisa_conferencia', v_precisa);
end $$;
revoke execute on function public.fn_clinic_fin_caixa_fechar(uuid, uuid, jsonb, text) from public, anon;
grant  execute on function public.fn_clinic_fin_caixa_fechar(uuid, uuid, jsonb, text) to authenticated;

-- ─── conferir (outra pessoa) ────────────────────────────────────────────────
create or replace function public.fn_clinic_fin_caixa_conferir(p_org uuid, p_caixa uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.clinic_fin_caixas;
begin
  perform public.fn_clinic_fin_exigir(p_org, 'financeiro.conferir');
  c := public.fn_clinic_fin_caixa_aberto(p_org, p_caixa);
  if c.status <> 'aguardando_conferencia' then
    raise exception 'fin_caixa_sem_conferencia' using errcode = '22023';
  end if;
  if c.fechado_por = auth.uid() then
    raise exception 'fin_conferencia_mesma_pessoa' using errcode = '42501';
  end if;
  perform public.fn_clinic_fin_caixa_encerrar(c.id, auth.uid());
  return jsonb_build_object('id', c.id, 'diferenca_cents', c.diferenca_cents);
end $$;
revoke execute on function public.fn_clinic_fin_caixa_conferir(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_fin_caixa_conferir(uuid, uuid) to authenticated;

-- ─── o dia do caixa: entradas, saídas, categorias, comparação ───────────────
-- Regime de CAIXA: lançamentos pagos no dia (data de pagamento no fuso da
-- clínica), todas as contas. Só agregados.
create or replace function public.fn_clinic_fin_dia(p_org uuid, p_dia date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_fuso text;
begin
  perform public.fn_acesso_exigir(p_org, 'financeiro.ver');
  select coalesce(nullif(o.timezone, ''), 'America/Sao_Paulo') into v_fuso from public.organizations o where o.id = p_org;
  return (
    with pagos as (
      select (e.paid_at at time zone v_fuso)::date as dia, e.direction, e.amount_cents, e.origin,
             coalesce(p.name, case e.origin
               when 'sale' then 'Vendas' when 'receivable' then 'Recebimentos de cartão'
               when 'card_fee' then 'Taxas de cartão' when 'anticipation' then 'Antecipação'
               when 'cash' then 'Caixa (caixa pequeno, sobras e faltas)' when 'reversal' then 'Estornos'
               when 'recurring' then 'Recorrentes' else 'Outros' end) as categoria
        from public.financial_entries e
        left join public.account_plans p on p.id = e.account_plan_id
       where e.organization_id = p_org and e.status = 'paid'
         and e.paid_at >= ((p_dia - 7)::timestamp at time zone v_fuso)
         and e.paid_at < ((p_dia + 1)::timestamp at time zone v_fuso)
    ), por_dia as (
      select d::date as dia,
             coalesce((select sum(case when x.direction = 'in' then x.amount_cents else -x.amount_cents end)
                         from pagos x where x.dia = d::date), 0) as saldo
        from generate_series(p_dia - 7, p_dia, interval '1 day') d
    )
    select jsonb_build_object(
      'dia', p_dia,
      'entradas_cents', coalesce((select sum(amount_cents) from pagos where dia = p_dia and direction = 'in'), 0),
      'saidas_cents', coalesce((select sum(amount_cents) from pagos where dia = p_dia and direction = 'out'), 0),
      'saldo_cents', (select saldo from por_dia where dia = p_dia),
      'ontem_cents', (select saldo from por_dia where dia = p_dia - 1),
      'media_7d_cents', (select round(avg(saldo))::bigint from por_dia where dia < p_dia),
      'por_categoria', coalesce((
        select jsonb_agg(jsonb_build_object('categoria', categoria, 'direcao', direction, 'total_cents', total)
                         order by direction, total desc)
          from (select categoria, direction, sum(amount_cents) as total from pagos where dia = p_dia
                 group by categoria, direction) g), '[]'::jsonb))
  );
end $$;
revoke execute on function public.fn_clinic_fin_dia(uuid, date) from public, anon;
grant  execute on function public.fn_clinic_fin_dia(uuid, date) to authenticated;

-- Limite da dupla conferência, junto das outras regras do financeiro.
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
     or (p_dados ? 'limite_conferencia_cents' and (
           jsonb_typeof(p_dados -> 'limite_conferencia_cents') <> 'number'
           or (p_dados ->> 'limite_conferencia_cents') !~ '^[0-9]{1,10}$'))
     or exists (select 1 from jsonb_object_keys(p_dados) k
                 where k not in ('comissao_base', 'margem_minima_pct', 'limite_conferencia_cents')) then
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
