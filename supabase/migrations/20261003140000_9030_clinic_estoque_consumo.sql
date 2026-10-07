-- ════════════════════════════════════════════════════════════════════════════
-- 9030 · clinic — estoque: baixa pelo prontuário (FORK, estoque E2)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/estoque/plano.md. Finalizar o atendimento publica
-- `clinic.procedimento_confirmado` (9022) para cada procedimento; o consumidor
-- (lib/clinic/estoque/consumo.handler.ts, pelo service role) chama
-- `fn_clinic_estoque_baixar_procedimento`, que lê os insumos DO BANCO (nunca do
-- payload) e, para cada insumo de produto configurado no estoque:
--
--   • local = o local ligado a uma sala do agendamento; senão o padrão;
--   • lote informado no insumo; sem lote, FEFO (vence primeiro, sai primeiro;
--     lote vencido não entra) — pode usar mais de um lote;
--   • quantidade na unidade de aplicação (insumo na unidade de estoque é
--     convertido pelo fator);
--   • uma operação `consumo` por insumo (origem única → idempotente), com
--     atendimento, paciente, profissional e procedimento nos movimentos; o
--     insumo guarda o id da operação em `movimento_estoque_id`.
--
-- O PRONTUÁRIO MANDA: finalizar nunca falha por estoque. O que não dá para
-- baixar vira PENDÊNCIA (sem saldo, lote desconhecido, sem local) — resolvida
-- depois pela tela (escolhe lote/local e baixa) ou descartada com motivo.
-- Produto controlado usado por profissional sem conselho permitido: baixa
-- normalmente e abre pendência `profissional_nao_habilitado` para revisão.
--
--   clinic_estoque_pendencias   o que não baixou (ou precisa de revisão)
--
-- Sem texto clínico: só ids, quantidades, lote e motivo. Aditiva e idempotente
-- (também anexada ao fim de supabase/baseline.sql).

create table if not exists public.clinic_estoque_pendencias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  insumo_id uuid not null references public.clinic_procedimento_insumos(id) on delete cascade,
  atendimento_id uuid not null,
  product_id uuid not null references public.catalog_products(id),
  quantidade numeric(14,3) not null,
  lote_informado text,
  motivo text not null,
  status text not null default 'aberta',
  operacao_id uuid,
  resolucao text,
  resolvida_por uuid,
  resolvida_em timestamptz,
  created_at timestamptz not null default now(),
  constraint clinic_estoque_pendencias_org_id_key unique (organization_id, id),
  constraint clinic_estoque_pendencias_unica unique (insumo_id, motivo),
  constraint clinic_estoque_pendencias_motivo check (motivo in (
    'sem_saldo', 'lote_desconhecido', 'sem_local', 'profissional_nao_habilitado')),
  constraint clinic_estoque_pendencias_status check (status in ('aberta', 'resolvida', 'descartada')),
  constraint clinic_estoque_pendencias_quantidade check (quantidade > 0),
  constraint clinic_estoque_pendencias_resolucao check (resolucao is null or char_length(btrim(resolucao)) between 1 and 300),
  constraint clinic_estoque_pendencias_atendimento_fk foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id) on delete cascade,
  constraint clinic_estoque_pendencias_operacao_fk foreign key (organization_id, operacao_id)
    references public.clinic_estoque_operacoes (organization_id, id)
);
create index if not exists clinic_estoque_pendencias_abertas_idx
  on public.clinic_estoque_pendencias (organization_id, created_at desc) where status = 'aberta';

do $rls$
begin
  alter table public.clinic_estoque_pendencias enable row level security;
  drop policy if exists tenant_isolation_clinic_estoque_pendencias_all on public.clinic_estoque_pendencias;
  create policy tenant_isolation_clinic_estoque_pendencias_all on public.clinic_estoque_pendencias
    using ((organization_id in (select public.fn_user_org_ids()))
           and public.fn_role_at_least(organization_id, 'viewer'))
    with check ((organization_id in (select public.fn_user_org_ids()))
           and public.fn_role_at_least(organization_id, 'viewer'));
  drop policy if exists acesso_ler on public.clinic_estoque_pendencias;
  create policy acesso_ler on public.clinic_estoque_pendencias as restrictive for select
    using (public.fn_has_permission(organization_id, 'estoque.ver'));
  revoke all on public.clinic_estoque_pendencias from anon;
  revoke insert, update, delete, truncate on public.clinic_estoque_pendencias from authenticated;
end
$rls$;

-- ─── peças internas ─────────────────────────────────────────────────────────
-- Onde o atendimento tira o estoque: o local de uma sala do agendamento, senão
-- o local padrão. Nulo = nenhum local ativo.
create or replace function public.fn_clinic_estoque_local_do_atendimento(p_org uuid, p_atendimento uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select l.id
       from public.clinic_atendimentos a
       join public.clinic_appointment_resources r on r.appointment_id = a.appointment_id
       join public.clinic_estoque_locais l
         on l.resource_id = r.resource_id and l.organization_id = p_org and l.ativo
      where a.id = p_atendimento and a.organization_id = p_org
      order by l.id
      limit 1),
    (select l.id from public.clinic_estoque_locais l
      where l.organization_id = p_org and l.padrao and l.ativo
      limit 1))
$$;
revoke execute on function public.fn_clinic_estoque_local_do_atendimento(uuid, uuid) from public, anon, authenticated;

-- Grava a saída de UM insumo: escolhe os lotes (informado ou FEFO), trava,
-- confere saldo e grava a operação. Devolve o id da operação, ou nulo +
-- o motivo da pendência em p_motivo (nada gravado).
create or replace function public.fn_clinic_estoque_consumir(
  p_org uuid, p_insumo uuid, p_local uuid, p_lotes uuid[], p_qtd numeric, p_ator uuid,
  out operacao_id uuid, out motivo text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ins record;
  v_restante numeric := round(p_qtd, 3);
  v_l record;
  v_tira numeric;
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
  if cardinality(coalesce(p_lotes, '{}')) = 0 then
    motivo := 'sem_saldo';
    return;
  end if;

  perform public.fn_clinic_estoque_travar(p_org, p_lotes);
  -- FEFO entre os lotes candidatos, com o saldo travado.
  insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, origem_id, ator)
  values (p_org, 'consumo', 'insumo', p_insumo, p_ator)
  returning id into operacao_id;
  for v_l in
    select l.id, l.custo_unitario_cents, public.fn_clinic_estoque_saldo(p_org, l.id, p_local) as saldo
      from public.clinic_estoque_lotes l
     where l.organization_id = p_org and l.id = any(p_lotes) and l.product_id = v_ins.product_id
     order by l.validade nulls last, l.created_at, l.id
  loop
    exit when v_restante <= 0;
    continue when v_l.saldo <= 0;
    v_tira := least(v_l.saldo, v_restante);
    insert into public.clinic_estoque_movimentos
      (organization_id, operacao_id, product_id, lote_id, local_id, quantidade, custo_unitario_cents,
       atendimento_id, contact_id, profissional_user_id, procedure_id)
    values (p_org, operacao_id, v_ins.product_id, v_l.id, p_local, -v_tira, v_l.custo_unitario_cents,
            v_ins.atendimento_id, v_ins.contact_id, v_ins.profissional, v_ins.procedure_id);
    v_restante := v_restante - v_tira;
  end loop;
  if v_restante > 0 then
    -- desfaz só esta operação (o chamador roda num subbloco)
    raise exception 'estoque_insuficiente' using errcode = '23514';
  end if;
  perform public.fn_clinic_estoque_conferir_saldos(p_org, operacao_id);

  update public.clinic_procedimento_insumos set movimento_estoque_id = operacao_id
   where id = p_insumo and organization_id = p_org;
end $$;
revoke execute on function public.fn_clinic_estoque_consumir(uuid, uuid, uuid, uuid[], numeric, uuid) from public, anon, authenticated;

-- Quantidade do insumo na unidade de aplicação.
create or replace function public.fn_clinic_estoque_qtd_aplicacao(p_cfg public.clinic_produto_estoque, p_qtd numeric, p_unidade text)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select round(case
    when lower(btrim(coalesce(p_unidade, ''))) = lower(btrim(p_cfg.unidade_estoque))
     and lower(btrim(p_cfg.unidade_estoque)) <> lower(btrim(p_cfg.unidade_aplicacao))
    then p_qtd * p_cfg.fator_conversao
    else p_qtd end, 3)
$$;
revoke execute on function public.fn_clinic_estoque_qtd_aplicacao(public.clinic_produto_estoque, numeric, text) from public, anon, authenticated;

-- ─── a baixa de um procedimento finalizado (consumidor, service role) ───────
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
    select i.id, i.product_id, i.quantidade, i.unidade, nullif(btrim(coalesce(i.lote, '')), '') as lote, i.validade,
           i.movimento_estoque_id
      from public.clinic_procedimento_insumos i
     where i.organization_id = p_org and i.procedimento_id = p_procedimento and i.product_id is not null
     order by i.created_at, i.id
  loop
    select * into v_cfg from public.clinic_produto_estoque e
     where e.organization_id = p_org and e.product_id = v_i.product_id;
    if v_cfg.id is null then
      v_livres := v_livres + 1;   -- produto fora do estoque: consumo livre
      continue;
    end if;
    v_qtd := public.fn_clinic_estoque_qtd_aplicacao(v_cfg, v_i.quantidade, v_i.unidade);

    -- já baixado (redelivery do evento)?
    select o.id into v_op from public.clinic_estoque_operacoes o
     where o.organization_id = p_org and o.origem_tipo = 'insumo' and o.origem_id = v_i.id and o.tipo <> 'estorno';
    if v_op is null then
      if v_i.lote is not null then
        select array_agg(l.id) into v_lotes from public.clinic_estoque_lotes l
         where l.organization_id = p_org and l.product_id = v_i.product_id and l.codigo = v_i.lote
           and (v_i.validade is null or l.validade = v_i.validade);
        if v_lotes is null then
          insert into public.clinic_estoque_pendencias
            (organization_id, insumo_id, atendimento_id, product_id, quantidade, lote_informado, motivo)
          values (p_org, v_i.id, v_proc.atendimento_id, v_i.product_id, v_qtd, v_i.lote, 'lote_desconhecido')
          on conflict (insumo_id, motivo) do nothing;
          v_pendencias := v_pendencias + 1;
          continue;
        end if;
      else
        select array_agg(l.id) into v_lotes from public.clinic_estoque_lotes l
         where l.organization_id = p_org and l.product_id = v_i.product_id
           and (l.validade is null or l.validade >= current_date);
      end if;

      begin
        select * into v_r from public.fn_clinic_estoque_consumir(p_org, v_i.id, v_local, v_lotes, v_qtd, v_proc.profissional);
      exception
        when sqlstate '23514' then
          select null::uuid as operacao_id, 'sem_saldo'::text as motivo into v_r;
        when unique_violation then
          -- outro consumidor baixou o mesmo insumo agora: fica a dele
          select o.id as operacao_id, null::text as motivo into v_r from public.clinic_estoque_operacoes o
           where o.organization_id = p_org and o.origem_tipo = 'insumo' and o.origem_id = v_i.id and o.tipo <> 'estorno';
      end;
      if v_r.operacao_id is null then
        insert into public.clinic_estoque_pendencias
          (organization_id, insumo_id, atendimento_id, product_id, quantidade, lote_informado, motivo)
        values (p_org, v_i.id, v_proc.atendimento_id, v_i.product_id, v_qtd, v_i.lote, v_r.motivo)
        on conflict (insumo_id, motivo) do nothing;
        v_pendencias := v_pendencias + 1;
        continue;
      end if;
      v_op := v_r.operacao_id;
    elsif v_i.movimento_estoque_id is distinct from v_op then
      update public.clinic_procedimento_insumos set movimento_estoque_id = v_op
       where id = v_i.id and organization_id = p_org;
    end if;
    v_baixados := v_baixados + 1;

    if v_cfg.controlado and (v_conselho is null or not (v_conselho = any(v_cfg.conselhos_permitidos))) then
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

-- ─── resolver uma pendência pela tela ───────────────────────────────────────
--   acao 'baixar'    (sem_saldo, lote_desconhecido, sem_local): escolhe lote e
--                    local; grava a saída e liga ao insumo;
--   acao 'descartar' (qualquer): o insumo não sai do estoque — motivo;
--   acao 'ciente'    (profissional_nao_habilitado): revisado — motivo.
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
    select * into v_r from public.fn_clinic_estoque_consumir(
      p_org, v_p.insumo_id, v_local, array[v_lote], v_p.quantidade, auth.uid());
    update public.clinic_estoque_pendencias
       set status = 'resolvida', operacao_id = v_r.operacao_id, resolvida_por = auth.uid(), resolvida_em = now()
     where id = v_p.id;
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
