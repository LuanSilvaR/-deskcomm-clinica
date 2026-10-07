-- ════════════════════════════════════════════════════════════════════════════
-- 9032 · clinic — estoque: fracionamento e frascos abertos (FORK, estoque E4)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/estoque/plano.md. Produto `fracionavel` (ex.: toxina,
-- frasco = 100 U) é usado aos poucos: o frasco é ABERTO e passa a ter conteúdo
-- próprio, com prazo (`validade_pos_abertura_horas`, limitado à validade do
-- lote). Saldo continua sendo soma de movimentos — o frasco é só mais uma
-- "gaveta" do mesmo lote e local (`movimentos.frasco_id`):
--
--   abrir    operação `abertura_frasco`: −fator lacrado, +fator no frasco
--            (o saldo do lote/local não muda);
--   usar     a baixa pelo prontuário tira primeiro de frasco aberto no prazo
--            (vence primeiro, sai primeiro); do lacrado, ABRE frasco sozinho
--            quando o produto é fracionável;
--   encerrar a sobra vira PERDA com motivo (frasco vencido, descartado);
--   vencido  fica à vista na tela até alguém encerrar (só alerta).
--
--   clinic_estoque_frascos          um frasco aberto
--   clinic_estoque_frascos_abertos  (view) frascos com o conteúdo atual
--
-- `fn_clinic_estoque_conferir_saldos` passa a conferir também cada gaveta
-- (lacrado e cada frasco): ninguém tira do lacrado o que está num frasco.
-- Aditiva e idempotente (também anexada ao fim de supabase/baseline.sql).

create table if not exists public.clinic_estoque_frascos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.catalog_products(id),
  lote_id uuid not null,
  local_id uuid not null,
  aberto_em timestamptz not null default now(),
  vence_em timestamptz,
  status text not null default 'aberto',
  encerrado_em timestamptz,
  aberto_por uuid,
  encerrado_por uuid,
  constraint clinic_estoque_frascos_org_id_key unique (organization_id, id),
  constraint clinic_estoque_frascos_status check (status in ('aberto', 'encerrado')),
  constraint clinic_estoque_frascos_encerrado check ((status = 'encerrado') = (encerrado_em is not null)),
  constraint clinic_estoque_frascos_lote_fk foreign key (organization_id, lote_id)
    references public.clinic_estoque_lotes (organization_id, id),
  constraint clinic_estoque_frascos_local_fk foreign key (organization_id, local_id)
    references public.clinic_estoque_locais (organization_id, id)
);
create index if not exists clinic_estoque_frascos_abertos_idx
  on public.clinic_estoque_frascos (organization_id, lote_id, local_id) where status = 'aberto';

-- o movimento aponta para um frasco da mesma empresa
do $fk$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_estoque_movimentos_frasco_fk') then
    alter table public.clinic_estoque_movimentos
      add constraint clinic_estoque_movimentos_frasco_fk foreign key (organization_id, frasco_id)
      references public.clinic_estoque_frascos (organization_id, id);
  end if;
end
$fk$;
create index if not exists clinic_estoque_movimentos_frasco_idx
  on public.clinic_estoque_movimentos (organization_id, frasco_id) where frasco_id is not null;

do $rls$
begin
  alter table public.clinic_estoque_frascos enable row level security;
  drop policy if exists tenant_isolation_clinic_estoque_frascos_all on public.clinic_estoque_frascos;
  create policy tenant_isolation_clinic_estoque_frascos_all on public.clinic_estoque_frascos
    using ((organization_id in (select public.fn_user_org_ids()))
           and public.fn_role_at_least(organization_id, 'viewer'))
    with check ((organization_id in (select public.fn_user_org_ids()))
           and public.fn_role_at_least(organization_id, 'viewer'));
  drop policy if exists acesso_ler on public.clinic_estoque_frascos;
  create policy acesso_ler on public.clinic_estoque_frascos as restrictive for select
    using (public.fn_has_permission(organization_id, 'estoque.ver'));
  revoke all on public.clinic_estoque_frascos from anon;
  revoke insert, update, delete, truncate on public.clinic_estoque_frascos from authenticated;
end
$rls$;

create or replace view public.clinic_estoque_frascos_abertos
with (security_invoker = true) as
  select f.id, f.organization_id, f.product_id, f.lote_id, f.local_id, f.aberto_em, f.vence_em,
         coalesce((select sum(m.quantidade) from public.clinic_estoque_movimentos m
                    where m.organization_id = f.organization_id and m.frasco_id = f.id), 0)::numeric(14,3) as conteudo,
         (f.vence_em is not null and f.vence_em <= now()) as vencido
    from public.clinic_estoque_frascos f
   where f.status = 'aberto';
revoke all on public.clinic_estoque_frascos_abertos from anon;
grant select on public.clinic_estoque_frascos_abertos to authenticated;

-- ─── conferência por gaveta (redefinida da 9028) ────────────────────────────
-- Nenhum (lote, local) E nenhuma gaveta (lacrado / cada frasco) da operação
-- pode ficar negativa.
create or replace function public.fn_clinic_estoque_conferir_saldos(p_org uuid, p_operacao uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from (select distinct m.lote_id, m.local_id, m.frasco_id from public.clinic_estoque_movimentos m
                    where m.organization_id = p_org and m.operacao_id = p_operacao) x
     where (select coalesce(sum(m.quantidade), 0) from public.clinic_estoque_movimentos m
             where m.organization_id = p_org and m.lote_id = x.lote_id and m.local_id = x.local_id
               and m.frasco_id is not distinct from x.frasco_id) < 0
        or public.fn_clinic_estoque_saldo(p_org, x.lote_id, x.local_id) < 0
  ) then
    raise exception 'estoque_insuficiente' using errcode = '23514';
  end if;
end $$;
revoke execute on function public.fn_clinic_estoque_conferir_saldos(uuid, uuid) from public, anon, authenticated;

-- ─── abrir um frasco (interna): grava a operação; devolve o frasco ──────────
create or replace function public.fn_clinic_estoque_frasco_abrir_interno(
  p_org uuid, p_lote uuid, p_local uuid, p_ator uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote public.clinic_estoque_lotes;
  v_cfg public.clinic_produto_estoque;
  v_frasco uuid;
  v_op uuid;
  v_vence timestamptz;
begin
  select * into v_lote from public.clinic_estoque_lotes l where l.id = p_lote and l.organization_id = p_org;
  if v_lote.id is null then
    raise exception 'estoque_lote_invalido' using errcode = '22023';
  end if;
  select * into v_cfg from public.clinic_produto_estoque e
   where e.organization_id = p_org and e.product_id = v_lote.product_id;
  if v_cfg.id is null or not v_cfg.fracionavel then
    raise exception 'estoque_nao_fracionavel' using errcode = '22023';
  end if;
  if v_lote.validade is not null and v_lote.validade < current_date then
    raise exception 'estoque_lote_vencido' using errcode = '22023';
  end if;
  v_vence := case when v_cfg.validade_pos_abertura_horas is not null
                  then now() + make_interval(hours => v_cfg.validade_pos_abertura_horas) end;
  if v_lote.validade is not null then
    v_vence := least(coalesce(v_vence, 'infinity'::timestamptz), (v_lote.validade + 1)::timestamptz);
  end if;
  insert into public.clinic_estoque_frascos (organization_id, product_id, lote_id, local_id, vence_em, aberto_por)
  values (p_org, v_lote.product_id, p_lote, p_local, v_vence, p_ator)
  returning id into v_frasco;
  insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, origem_id, ator)
  values (p_org, 'abertura_frasco', 'frasco', v_frasco, p_ator)
  returning id into v_op;
  insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, frasco_id, quantidade, custo_unitario_cents)
  values (p_org, v_op, v_lote.product_id, p_lote, p_local, null, -v_cfg.fator_conversao, v_lote.custo_unitario_cents),
         (p_org, v_op, v_lote.product_id, p_lote, p_local, v_frasco, v_cfg.fator_conversao, v_lote.custo_unitario_cents);
  perform public.fn_clinic_estoque_conferir_saldos(p_org, v_op);
  return v_frasco;
end $$;
revoke execute on function public.fn_clinic_estoque_frasco_abrir_interno(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- Pela tela do estoque (estoque.movimentar).
create or replace function public.fn_clinic_estoque_frasco_abrir(p_org uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote uuid := nullif(p_dados ->> 'lote_id', '')::uuid;
  v_local uuid := nullif(p_dados ->> 'local_id', '')::uuid;
  v_frasco uuid;
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.movimentar');
  perform public.fn_clinic_estoque_lote_da_org(p_org, v_lote);
  perform public.fn_clinic_estoque_local_valido(p_org, v_local);
  perform public.fn_clinic_estoque_travar(p_org, array[v_lote]);
  v_frasco := public.fn_clinic_estoque_frasco_abrir_interno(p_org, v_lote, v_local, auth.uid());
  return jsonb_build_object('frasco_id', v_frasco);
end $$;
revoke execute on function public.fn_clinic_estoque_frasco_abrir(uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_frasco_abrir(uuid, jsonb) to authenticated;

-- Encerrar: a sobra vira perda (com motivo); o frasco sai da lista.
create or replace function public.fn_clinic_estoque_frasco_encerrar(p_org uuid, p_frasco uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_f public.clinic_estoque_frascos;
  v_sobra numeric;
  v_op uuid;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform public.fn_clinic_estoque_exigir(p_org, 'estoque.movimentar');
  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception 'estoque_sem_motivo' using errcode = '22023';
  end if;
  select * into v_f from public.clinic_estoque_frascos f where f.id = p_frasco and f.organization_id = p_org;
  if v_f.id is null then
    raise exception 'estoque_frasco_invalido' using errcode = 'P0002';
  end if;
  perform public.fn_clinic_estoque_travar(p_org, array[v_f.lote_id]);
  select * into v_f from public.clinic_estoque_frascos f where f.id = p_frasco for update;
  if v_f.status <> 'aberto' then
    raise exception 'estoque_frasco_encerrado' using errcode = '22023';
  end if;
  select coalesce(sum(m.quantidade), 0) into v_sobra from public.clinic_estoque_movimentos m
   where m.organization_id = p_org and m.frasco_id = p_frasco;
  if v_sobra > 0 then
    insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, motivo, ator)
    values (p_org, 'perda', 'frasco', left(v_motivo, 300), auth.uid())
    returning id into v_op;
    insert into public.clinic_estoque_movimentos (organization_id, operacao_id, product_id, lote_id, local_id, frasco_id, quantidade)
    values (p_org, v_op, v_f.product_id, v_f.lote_id, v_f.local_id, p_frasco, -v_sobra);
    perform public.fn_clinic_estoque_conferir_saldos(p_org, v_op);
  end if;
  update public.clinic_estoque_frascos set status = 'encerrado', encerrado_em = now(), encerrado_por = auth.uid()
   where id = p_frasco;
  return jsonb_build_object('perda', v_sobra, 'operacao_id', v_op);
end $$;
revoke execute on function public.fn_clinic_estoque_frasco_encerrar(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_estoque_frasco_encerrar(uuid, uuid, text) to authenticated;

-- ─── a baixa de um insumo (redefinida da 9030): frasco aberto primeiro ─────
-- Ordem: frascos abertos no prazo (vence primeiro), depois o lacrado por FEFO
-- do lote. Do lacrado de produto fracionável, abre frasco (um por vez) e tira
-- dele; do não fracionável, tira direto.
create or replace function public.fn_clinic_estoque_consumir(
  p_org uuid, p_insumo uuid, p_local uuid, p_lotes uuid[], p_qtd numeric, p_ator uuid,
  out operacao_id uuid, out motivo text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ins record;
  v_cfg public.clinic_produto_estoque;
  v_restante numeric := round(p_qtd, 3);
  v_g record;
  v_tira numeric;
  v_frasco uuid;
  v_lacrado numeric;
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
  select * into v_cfg from public.clinic_produto_estoque e
   where e.organization_id = p_org and e.product_id = v_ins.product_id;

  perform public.fn_clinic_estoque_travar(p_org, p_lotes);
  insert into public.clinic_estoque_operacoes (organization_id, tipo, origem_tipo, origem_id, ator)
  values (p_org, 'consumo', 'insumo', p_insumo, p_ator)
  returning id into operacao_id;

  -- 1) frascos abertos no prazo
  for v_g in
    select f.id as frasco_id, f.lote_id, l.custo_unitario_cents,
           (select coalesce(sum(m.quantidade), 0) from public.clinic_estoque_movimentos m
             where m.organization_id = p_org and m.frasco_id = f.id) as saldo
      from public.clinic_estoque_frascos f
      join public.clinic_estoque_lotes l on l.id = f.lote_id
     where f.organization_id = p_org and f.status = 'aberto' and f.local_id = p_local
       and f.lote_id = any(p_lotes) and f.product_id = v_ins.product_id
       and (f.vence_em is null or f.vence_em > now())
     order by f.vence_em nulls last, f.aberto_em, f.id
  loop
    exit when v_restante <= 0;
    continue when v_g.saldo <= 0;
    v_tira := least(v_g.saldo, v_restante);
    insert into public.clinic_estoque_movimentos
      (organization_id, operacao_id, product_id, lote_id, local_id, frasco_id, quantidade, custo_unitario_cents,
       atendimento_id, contact_id, profissional_user_id, procedure_id)
    values (p_org, operacao_id, v_ins.product_id, v_g.lote_id, p_local, v_g.frasco_id, -v_tira, v_g.custo_unitario_cents,
            v_ins.atendimento_id, v_ins.contact_id, v_ins.profissional, v_ins.procedure_id);
    v_restante := v_restante - v_tira;
  end loop;

  -- 2) lacrado, por FEFO do lote
  for v_g in
    select l.id as lote_id, l.custo_unitario_cents, (l.validade is not null and l.validade < current_date) as vencido
      from public.clinic_estoque_lotes l
     where l.organization_id = p_org and l.id = any(p_lotes) and l.product_id = v_ins.product_id
     order by l.validade nulls last, l.created_at, l.id
  loop
    exit when v_restante <= 0;
    loop
      exit when v_restante <= 0;
      select coalesce(sum(m.quantidade), 0) into v_lacrado from public.clinic_estoque_movimentos m
       where m.organization_id = p_org and m.lote_id = v_g.lote_id and m.local_id = p_local and m.frasco_id is null;
      exit when v_lacrado <= 0;
      -- lote vencido informado no insumo: o que foi usado sai direto (não abre frasco)
      if coalesce(v_cfg.fracionavel, false) and not v_g.vencido and v_lacrado >= v_cfg.fator_conversao then
        -- abre um frasco e tira dele
        v_frasco := public.fn_clinic_estoque_frasco_abrir_interno(p_org, v_g.lote_id, p_local, p_ator);
        v_tira := least(v_cfg.fator_conversao, v_restante);
      else
        v_frasco := null;
        v_tira := least(v_lacrado, v_restante);
      end if;
      insert into public.clinic_estoque_movimentos
        (organization_id, operacao_id, product_id, lote_id, local_id, frasco_id, quantidade, custo_unitario_cents,
         atendimento_id, contact_id, profissional_user_id, procedure_id)
      values (p_org, operacao_id, v_ins.product_id, v_g.lote_id, p_local, v_frasco, -v_tira, v_g.custo_unitario_cents,
              v_ins.atendimento_id, v_ins.contact_id, v_ins.profissional, v_ins.procedure_id);
      v_restante := v_restante - v_tira;
    end loop;
  end loop;

  if v_restante > 0 then
    raise exception 'estoque_insuficiente' using errcode = '23514';
  end if;
  perform public.fn_clinic_estoque_conferir_saldos(p_org, operacao_id);

  update public.clinic_procedimento_insumos set movimento_estoque_id = operacao_id
   where id = p_insumo and organization_id = p_org;
end $$;
revoke execute on function public.fn_clinic_estoque_consumir(uuid, uuid, uuid, uuid[], numeric, uuid) from public, anon, authenticated;
