-- ════════════════════════════════════════════════════════════════════════════
-- 8009 · clinic — orçamento O4: pós-aceite → plano de tratamento e comanda (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/orcamento/plano.md (fase O4). Depende da 8008.
--
-- Quando o contrato é aceito (o orçamento vira "aprovado", gatilho da 8008),
-- na MESMA transação e sem HTTP:
--   1. PLANO DE TRATAMENTO (clinic_planos_tratamento + clinic_plano_sessoes,
--      9021) com as sessões contratadas: cada item vira sessões × quantidade
--      sessões PLANEJADAS do procedimento/tipo de serviço;
--   2. COMANDA ABERTA (sales + sale_items, 0351) com os itens, os preços do
--      orçamento e o desconto; comissão resolvida como na inclusão manual
--      (pessoa+serviço → pessoa → serviço, só regra em vigor). A forma e as
--      parcelas combinadas vão na observação: quem finaliza é o caixa (o
--      parcelamento com recebíveis chega com a FN2, #58).
-- A ligação com a comanda fica em clinic_orcamento_vendas (1:1) — o núcleo
-- (sales) não ganha coluna. O plano fica em clinic_orcamentos.plano_id.
--
-- IDEMPOTENTE: reprocessar não duplica nada. Se algo falhar, o ACEITE NÃO SE
-- PERDE: o erro fica em clinic_orcamentos.pos_aceite_erro e quem tem
-- orcamentos.criar reprocessa (fn_clinic_orcamento_reprocessar). Aditiva.

-- ─── colunas e a ligação com a comanda ─────────────────────────────────────
alter table public.clinic_orcamentos add column if not exists plano_id uuid;
alter table public.clinic_orcamentos add column if not exists pos_aceite_em timestamptz;
alter table public.clinic_orcamentos add column if not exists pos_aceite_erro text;
do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_orcamentos_plano_fk') then
    alter table public.clinic_orcamentos add constraint clinic_orcamentos_plano_fk
      foreign key (organization_id, plano_id) references public.clinic_planos_tratamento (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_orcamentos_pos_aceite_erro') then
    alter table public.clinic_orcamentos add constraint clinic_orcamentos_pos_aceite_erro
      check (pos_aceite_erro is null or char_length(pos_aceite_erro) <= 300);
  end if;
end
$c$;

create table if not exists public.clinic_orcamento_vendas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  orcamento_id uuid not null,
  sale_id uuid not null references public.sales(id),
  created_at timestamptz not null default now(),
  constraint clinic_orcamento_vendas_orcamento_key unique (organization_id, orcamento_id),
  constraint clinic_orcamento_vendas_sale_key unique (sale_id),
  constraint clinic_orcamento_vendas_orcamento_fk foreign key (organization_id, orcamento_id)
    references public.clinic_orcamentos (organization_id, id) on delete cascade
);

alter table public.clinic_orcamento_vendas enable row level security;
drop policy if exists tenant_isolation_clinic_orcamento_vendas_all on public.clinic_orcamento_vendas;
create policy tenant_isolation_clinic_orcamento_vendas_all on public.clinic_orcamento_vendas
  using ((organization_id in (select public.fn_user_org_ids()))
         and public.fn_role_at_least(organization_id, 'viewer'))
  with check ((organization_id in (select public.fn_user_org_ids()))
         and public.fn_role_at_least(organization_id, 'viewer'));
drop policy if exists acesso_ler on public.clinic_orcamento_vendas;
create policy acesso_ler on public.clinic_orcamento_vendas as restrictive for select
  using (public.fn_has_permission(organization_id, 'orcamentos.ver'));
revoke all on public.clinic_orcamento_vendas from anon;
revoke insert, update, delete, truncate on public.clinic_orcamento_vendas from authenticated;

-- ─── o pós-aceite (interno; idempotente) ───────────────────────────────────
create or replace function public.fn_clinic_orcamento_pos_aceite(p_org uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.clinic_orcamentos;
  it record;
  v_plano uuid;
  v_sale uuid;
  v_n integer := 0;
  v_total_sessoes integer;
  v_numero bigint;
  v_tentativa integer;
  v_pct numeric;
  v_resumo text;
  c jsonb;
begin
  select * into v from public.clinic_orcamentos o
   where o.organization_id = p_org and o.id = p_id for update;
  if not found or v.status <> 'aprovado' then
    raise exception 'orcamento_nao_aprovado' using errcode = '22023';
  end if;

  -- 1. plano de tratamento
  v_plano := v.plano_id;
  if v_plano is null then
    select coalesce(sum(i.sessoes * i.quantidade), 0) into v_total_sessoes
      from public.clinic_orcamento_itens i where i.organization_id = p_org and i.orcamento_id = p_id;
    if v_total_sessoes > 500 then
      raise exception 'orcamento_sessoes_demais' using errcode = '22023';
    end if;
    insert into public.clinic_planos_tratamento
      (organization_id, contact_id, atendimento_origem_id, profissional_user_id, titulo, objetivo, inicio, status,
       created_by, updated_by)
    values (p_org, v.contact_id, v.atendimento_id, v.profissional_user_id,
            left('Orçamento Nº ' || v.numero || case when v.versao > 1 then ' v' || v.versao else '' end || ' — contrato aceito', 120),
            'Sessões contratadas no orçamento aprovado.', current_date, 'ativo', v.enviado_por, v.enviado_por)
    returning id into v_plano;
    for it in
      select i.* from public.clinic_orcamento_itens i
       where i.organization_id = p_org and i.orcamento_id = p_id order by i.posicao
    loop
      for k in 1..(it.sessoes * it.quantidade) loop
        v_n := v_n + 1;
        insert into public.clinic_plano_sessoes
          (organization_id, plano_id, numero, descricao, event_type_id, procedure_id, updated_by)
        values (p_org, v_plano, v_n,
                left(it.descricao || case when it.sessoes * it.quantidade > 1
                                          then ' (' || k || '/' || (it.sessoes * it.quantidade) || ')' else '' end, 200),
                it.event_type_id, it.procedure_id, v.enviado_por);
      end loop;
    end loop;
    update public.clinic_orcamentos set plano_id = v_plano where organization_id = p_org and id = p_id;
  end if;

  -- 2. comanda aberta
  select ov.sale_id into v_sale from public.clinic_orcamento_vendas ov
   where ov.organization_id = p_org and ov.orcamento_id = p_id;
  if v_sale is null then
    c := v.condicao_pagamento;
    v_resumo := 'Orçamento Nº ' || v.numero || case when v.versao > 1 then ' v' || v.versao else '' end
      || ' (contrato aceito). Pagamento combinado: '
      || case c ->> 'forma'
           when 'dinheiro' then 'dinheiro, à vista'
           when 'pix' then 'Pix, à vista'
           when 'debito' then 'cartão de débito, à vista'
           when 'credito' then 'cartão de crédito, à vista'
           else coalesce('entrada de R$ ' || to_char(((c -> 'entrada' ->> 'valor_cents')::numeric / 100), 'FM999999990.00')
                         || ' (' || (c -> 'entrada' ->> 'forma') || ') + ', '')
                || (c ->> 'parcelas') || 'x no cartão de crédito'
         end || '.';
    v_tentativa := 0;
    loop
      begin
        perform pg_advisory_xact_lock(hashtextextended('sales_numero:' || p_org, 0));
        select coalesce(max(s.number), 0) + 1 into v_numero from public.sales s where s.organization_id = p_org;
        insert into public.sales (organization_id, number, contact_id, attendant_user_id, status,
                                  discount_cents, total_cents, notes, created_by_user_id)
        values (p_org, v_numero, v.contact_id, v.profissional_user_id, 'open',
                v.desconto_cents, v.total_cents, left(v_resumo, 1000), v.enviado_por)
        returning id into v_sale;
        exit;
      exception when unique_violation then
        v_tentativa := v_tentativa + 1;
        if v_tentativa >= 5 then
          raise;
        end if;
      end;
    end loop;
    for it in
      select i.* from public.clinic_orcamento_itens i
       where i.organization_id = p_org and i.orcamento_id = p_id order by i.posicao
    loop
      -- comissão como na inclusão manual: a regra mais específica em vigor
      select r.percent into v_pct
        from public.commission_rules r
       where r.organization_id = p_org and r.is_active
         and ((r.attendant_user_id = v.profissional_user_id and r.event_type_id = it.event_type_id)
              or (r.attendant_user_id = v.profissional_user_id and r.event_type_id is null)
              or (r.attendant_user_id is null and r.event_type_id = it.event_type_id))
       order by (r.attendant_user_id is not null and r.event_type_id is not null) desc,
                (r.attendant_user_id is not null) desc
       limit 1;
      insert into public.sale_items (organization_id, sale_id, event_type_id, description, attendant_user_id,
                                     quantity, unit_price_cents, discount_cents, total_cents, commission_percent)
      values (p_org, v_sale, it.event_type_id, it.descricao, v.profissional_user_id,
              it.quantidade, it.preco_unit_cents, 0, it.total_cents, coalesce(v_pct, 0));
    end loop;
    insert into public.clinic_orcamento_vendas (organization_id, orcamento_id, sale_id) values (p_org, p_id, v_sale);
  end if;

  update public.clinic_orcamentos set pos_aceite_em = coalesce(pos_aceite_em, now()), pos_aceite_erro = null
   where organization_id = p_org and id = p_id;
  return jsonb_build_object('plano_id', v_plano, 'sale_id', v_sale);
end $$;
revoke execute on function public.fn_clinic_orcamento_pos_aceite(uuid, uuid) from public, anon, authenticated;

-- ─── gatilho: aprovado → pós-aceite, sem nunca derrubar o aceite ────────────
create or replace function public.fn_clinic_orcamento_ao_aprovar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'aprovado' and old.status is distinct from 'aprovado' then
    begin
      perform public.fn_clinic_orcamento_pos_aceite(new.organization_id, new.id);
    exception when others then
      -- O aceite é a prova jurídica: ele fica. O que faltou fica visível e reprocessável.
      update public.clinic_orcamentos
         set pos_aceite_erro = left('Não foi possível gerar o plano e a comanda (' || sqlerrm || '). Use "Gerar plano e comanda".', 300)
       where organization_id = new.organization_id and id = new.id;
    end;
  end if;
  return null;
end $$;
revoke execute on function public.fn_clinic_orcamento_ao_aprovar() from public, anon, authenticated;
drop trigger if exists trg_clinic_orcamento_ao_aprovar on public.clinic_orcamentos;
create trigger trg_clinic_orcamento_ao_aprovar after update of status on public.clinic_orcamentos
  for each row execute function public.fn_clinic_orcamento_ao_aprovar();

-- ─── reprocessar (botão "Gerar plano e comanda") ────────────────────────────
create or replace function public.fn_clinic_orcamento_reprocessar(p_org uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_clinic_orcamentos_exigir(p_org, 'orcamentos.criar');
  if not exists (select 1 from public.clinic_orcamentos o where o.organization_id = p_org and o.id = p_id) then
    raise exception 'orcamento_invalido' using errcode = '22023';
  end if;
  return public.fn_clinic_orcamento_pos_aceite(p_org, p_id);
end $$;
revoke execute on function public.fn_clinic_orcamento_reprocessar(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_orcamento_reprocessar(uuid, uuid) to authenticated;
