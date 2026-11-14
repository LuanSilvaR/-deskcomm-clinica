-- ════════════════════════════════════════════════════════════════════════════
-- 8010 · clinic — orçamento O5: correções das revisões security-lgpd e
--                 health-compliance (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/orcamento/plano.md (fase O5). Depende da 8009.
--
--   1. DISTRATO: revogar o contrato ACEITO (aba Documentos) cancela o orçamento
--      aprovado, deixa o plano gerado "pausado" e cancela a comanda ainda
--      ABERTA (finalizada segue para estorno pelo caixa — o motivo diz isso);
--   2. o plano gerado pelo aceite nasce RASCUNHO ("a confirmar pelo
--      profissional"): sessão contratada não é indicação clínica (CFM 1.821);
--   3. ENVIAR revalida a vigência do preço (nova versão copia itens) e confere
--      que o texto do contrato traz o total e cada item do orçamento gravado;
--   4. pos_aceite_erro guarda o CÓDIGO do erro, nunca a mensagem bruta do banco;
--   5. ANONIMIZAR o paciente redige o texto livre dos orçamentos dele
--      (observação, motivos, observação do pagamento). Itens, valores e o
--      contrato aceito ficam: são prova da relação de consumo (LGPD art. 16, II).
-- Gatilhos sem HTTP. Aditiva e idempotente.

-- ─── 1. documento ↔ orçamento, agora com a revogação ───────────────────────
create or replace function public.fn_clinic_orcamento_pelo_documento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plano uuid;
  v_sale uuid;
begin
  if tg_op = 'UPDATE' and old.orcamento_id is not null and new.orcamento_id is distinct from old.orcamento_id then
    raise exception 'documento_imutavel' using errcode = '55000';
  end if;
  if tg_when = 'BEFORE' then
    return new;
  end if;
  if new.orcamento_id is null or new.status = old.status then
    return null;
  end if;
  if old.status = 'emitido' and new.status = 'aceito' then
    update public.clinic_orcamentos
       set status = 'aprovado', aprovado_em = now(), updated_at = now()
     where organization_id = new.organization_id and id = new.orcamento_id and status = 'enviado';
  elsif old.status = 'emitido' and new.status = 'cancelado' then
    update public.clinic_orcamentos
       set status = 'cancelado', cancelado_em = now(), cancelado_por = auth.uid(),
           motivo_cancelamento = left(coalesce(new.motivo, 'Contrato cancelado'), 300), updated_at = now()
     where organization_id = new.organization_id and id = new.orcamento_id and status = 'enviado';
  elsif old.status = 'aceito' and new.status = 'revogado' then
    update public.clinic_orcamentos
       set status = 'cancelado', cancelado_em = now(), cancelado_por = auth.uid(),
           motivo_cancelamento = left('Contrato revogado (distrato). ' || coalesce(new.motivo, ''), 300), updated_at = now()
     where organization_id = new.organization_id and id = new.orcamento_id and status = 'aprovado'
    returning plano_id into v_plano;
    if found then
      update public.clinic_planos_tratamento set status = 'pausado', versao = versao + 1, updated_by = auth.uid()
       where organization_id = new.organization_id and id = v_plano and status in ('rascunho', 'ativo');
      select ov.sale_id into v_sale from public.clinic_orcamento_vendas ov
       where ov.organization_id = new.organization_id and ov.orcamento_id = new.orcamento_id;
      update public.sales set status = 'cancelled', cancelled_at = now(),
             cancel_reason = 'Contrato do orçamento revogado (distrato).'
       where organization_id = new.organization_id and id = v_sale and status = 'open';
    end if;
  end if;
  return null;
end $$;
revoke execute on function public.fn_clinic_orcamento_pelo_documento() from public, anon, authenticated;

-- ─── 2. pós-aceite: plano nasce rascunho ───────────────────────────────────
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
            'Sessões contratadas no orçamento aprovado. A confirmar pelo profissional (não é indicação clínica).',
            current_date, 'rascunho', v.enviado_por, v.enviado_por)
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

-- ─── 4. erro do pós-aceite: só o código ────────────────────────────────────
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
      -- O aceite é a prova jurídica: ele fica. O que faltou fica visível e
      -- reprocessável — com o código do erro, nunca a mensagem bruta do banco.
      update public.clinic_orcamentos
         set pos_aceite_erro = left(case when sqlerrm ~ '^orcamento_[a-z_]+$' then sqlerrm else 'erro_' || sqlstate end, 300)
       where organization_id = new.organization_id and id = new.id;
    end;
  end if;
  return null;
end $$;
revoke execute on function public.fn_clinic_orcamento_ao_aprovar() from public, anon, authenticated;

-- ─── 3. enviar: vigência do preço e texto conferidos ───────────────────────
create or replace function public.fn_clinic_orcamento_enviar(
  p_org uuid, p_id uuid, p_modelo_versao uuid, p_titulo text, p_conteudo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.clinic_orcamentos;
  v_tipo text;
  v_doc jsonb;
begin
  perform public.fn_clinic_orcamentos_exigir(p_org, 'orcamentos.criar');
  select * into v from public.clinic_orcamentos o where o.organization_id = p_org and o.id = p_id for update;
  if not found then
    raise exception 'orcamento_invalido' using errcode = '22023';
  end if;
  if v.status <> 'rascunho' then
    raise exception 'orcamento_nao_editavel' using errcode = '55000';
  end if;
  if v.desconto_pendente then
    raise exception 'orcamento_desconto_pendente' using errcode = '22023';
  end if;
  if v.validade_ate < current_date then
    raise exception 'orcamento_vencido' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clinic_orcamento_itens i where i.organization_id = p_org and i.orcamento_id = p_id) then
    raise exception 'orcamento_dados_invalidos' using errcode = '22023';
  end if;
  -- Nova versão copia itens: o preço tem de continuar o vigente e ativo.
  if exists (
    select 1 from public.clinic_orcamento_itens i
      join public.clinic_precos p on p.organization_id = i.organization_id and p.id = i.preco_id
     where i.organization_id = p_org and i.orcamento_id = p_id
       and (not p.ativo or p.preco_cents <> i.preco_unit_cents or exists (
             select 1 from public.clinic_precos n
              where n.organization_id = p_org
                and coalesce(n.procedure_id, n.event_type_id) = coalesce(p.procedure_id, p.event_type_id)
                and n.sessoes = p.sessoes and n.vigente_desde <= now()
                and (n.vigente_desde, n.created_at, n.id) > (p.vigente_desde, p.created_at, p.id)))) then
    raise exception 'orcamento_preco_desatualizado' using errcode = '22023';
  end if;
  -- O texto que o paciente vai aceitar tem de trazer o total e cada item do
  -- orçamento gravado (o servidor monta; a RPC não aceita um texto qualquer).
  if position(translate(to_char(v.total_cents / 100.0, 'FM999,999,990.00'), ',.', '.,') in coalesce(p_conteudo, '')) = 0
     or exists (select 1 from public.clinic_orcamento_itens i
                 where i.organization_id = p_org and i.orcamento_id = p_id
                   and position(i.descricao in coalesce(p_conteudo, '')) = 0) then
    raise exception 'orcamento_texto_divergente' using errcode = '22023';
  end if;
  select m.tipo into v_tipo
    from public.clinic_modelos_documento_versoes mv
    join public.clinic_modelos_documento m on m.id = mv.modelo_id
   where mv.id = p_modelo_versao and mv.organization_id = p_org;
  if v_tipo is distinct from 'contrato' then
    raise exception 'orcamento_modelo_invalido' using errcode = '22023';
  end if;

  -- documentos.emitir, MFA, prontuário ligado e paciente/atendimento conferidos lá dentro.
  v_doc := public.fn_clinic_documento_emitir(p_org, v.contact_id, p_modelo_versao, p_titulo, p_conteudo,
                                              v.atendimento_id, null, v.validade_ate);
  update public.clinic_documentos_emitidos set orcamento_id = p_id
   where organization_id = p_org and id = (v_doc ->> 'id')::uuid;
  update public.clinic_orcamentos set
    status = 'enviado',
    enviado_em = now(),
    enviado_por = auth.uid(),
    documento_id = (v_doc ->> 'id')::uuid,
    updated_by = auth.uid(),
    updated_at = now()
   where organization_id = p_org and id = p_id;
  return jsonb_build_object('id', p_id, 'documento_id', v_doc ->> 'id', 'sha256', v_doc ->> 'sha256');
end $$;
revoke execute on function public.fn_clinic_orcamento_enviar(uuid, uuid, uuid, text, text) from public, anon;
grant  execute on function public.fn_clinic_orcamento_enviar(uuid, uuid, uuid, text, text) to authenticated;

-- ─── 5. anonimizar o paciente redige o texto livre dos orçamentos ──────────
create or replace function public.fn_clinic_orcamentos_redigir_ao_anonimizar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.clinic_orcamentos o
     set observacao = null,
         motivo_cancelamento = case when o.motivo_cancelamento is null then null else '[anonimizado]' end,
         motivo_recusa = case when o.motivo_recusa is null then null else '[anonimizado]' end,
         condicao_pagamento = o.condicao_pagamento - 'observacao',
         updated_at = now()
   where o.organization_id = new.organization_id and o.contact_id = new.id;
  return null;
end $$;
revoke all on function public.fn_clinic_orcamentos_redigir_ao_anonimizar() from public;
revoke execute on function public.fn_clinic_orcamentos_redigir_ao_anonimizar() from anon, authenticated;
drop trigger if exists trg_clinic_orcamentos_redigir_ao_anonimizar on public.contacts;
create trigger trg_clinic_orcamentos_redigir_ao_anonimizar
  after update of is_anonymized on public.contacts
  for each row
  when (new.is_anonymized = true and coalesce(old.is_anonymized, false) = false)
  execute function public.fn_clinic_orcamentos_redigir_ao_anonimizar();
