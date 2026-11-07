-- ════════════════════════════════════════════════════════════════════════════
-- 8008 · clinic — orçamento O3: o envio gera o contrato (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/orcamento/plano.md (fase O3). Depende da 8007.
--
-- O contrato NÃO é um sistema paralelo: é um documento do tipo `contrato` do
-- módulo de documentos (9023), emitido por fn_clinic_documento_emitir com o
-- texto já renderizado pelo servidor (itens, valores e forma de pagamento) e
-- congelado com sha256. O aceite (presencial ou link) é o de sempre.
--
--   • clinic_orcamentos ganha enviado_em/por, documento_id, aprovado_em,
--     recusado_em, expirado_em e motivo_recusa (aditivo);
--   • clinic_documentos_emitidos ganha orcamento_id (aditivo, FK composta; uma
--     vez preenchido não muda);
--   • ENVIAR: rascunho → enviado, sem desconto pendente e dentro da validade;
--   • o ACEITE do contrato aprova o orçamento (gatilho em
--     clinic_documentos_emitidos: emitido → aceito); cancelar o documento pela
--     aba Documentos cancela o orçamento enviado junto;
--   • RECUSAR (enviado → recusado), CANCELAR (rascunho ou enviado → cancelado),
--     NOVA VERSÃO (enviado → substituído + rascunho novo com o mesmo número) e
--     EXPIRAR (cron, só service role) cancelam o contrato ainda não respondido.
-- Gatilho sem HTTP. Aditiva e idempotente.

-- ─── colunas novas ──────────────────────────────────────────────────────────
alter table public.clinic_orcamentos add column if not exists enviado_em timestamptz;
alter table public.clinic_orcamentos add column if not exists enviado_por uuid references auth.users(id) on delete set null;
alter table public.clinic_orcamentos add column if not exists documento_id uuid;
alter table public.clinic_orcamentos add column if not exists aprovado_em timestamptz;
alter table public.clinic_orcamentos add column if not exists recusado_em timestamptz;
alter table public.clinic_orcamentos add column if not exists expirado_em timestamptz;
alter table public.clinic_orcamentos add column if not exists motivo_recusa text;

alter table public.clinic_documentos_emitidos add column if not exists orcamento_id uuid;
create index if not exists clinic_documentos_emitidos_orcamento_idx
  on public.clinic_documentos_emitidos (organization_id, orcamento_id) where orcamento_id is not null;

do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_orcamentos_documento_fk') then
    alter table public.clinic_orcamentos add constraint clinic_orcamentos_documento_fk
      foreign key (organization_id, documento_id) references public.clinic_documentos_emitidos (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_documentos_emitidos_do_orcamento') then
    alter table public.clinic_documentos_emitidos add constraint clinic_documentos_emitidos_do_orcamento
      foreign key (organization_id, orcamento_id) references public.clinic_orcamentos (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_orcamentos_motivo_recusa') then
    alter table public.clinic_orcamentos add constraint clinic_orcamentos_motivo_recusa
      check (motivo_recusa is null or char_length(motivo_recusa) <= 300);
  end if;
end
$c$;

-- ─── documento ↔ orçamento ──────────────────────────────────────────────────
-- (1) orcamento_id, uma vez preenchido, não muda; (2) o aceite do contrato
-- aprova o orçamento enviado; (3) cancelar o contrato não respondido cancela o
-- orçamento enviado. Só mexe em orçamento ENVIADO — quem já saiu desse estado
-- (recusa, expiração, nova versão) chegou aqui pela função que cancelou.
create or replace function public.fn_clinic_orcamento_pelo_documento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
  end if;
  return null;
end $$;
revoke execute on function public.fn_clinic_orcamento_pelo_documento() from public, anon, authenticated;
drop trigger if exists trg_clinic_documento_orcamento_fixo on public.clinic_documentos_emitidos;
create trigger trg_clinic_documento_orcamento_fixo before update of orcamento_id on public.clinic_documentos_emitidos
  for each row execute function public.fn_clinic_orcamento_pelo_documento();
drop trigger if exists trg_clinic_documento_orcamento_status on public.clinic_documentos_emitidos;
create trigger trg_clinic_documento_orcamento_status after update of status on public.clinic_documentos_emitidos
  for each row execute function public.fn_clinic_orcamento_pelo_documento();

-- Cancela o contrato ainda NÃO respondido de um orçamento (e mata o link).
create or replace function public.fn_clinic_orcamento_cancelar_contrato(p_org uuid, p_orcamento uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc uuid;
begin
  select o.documento_id into v_doc from public.clinic_orcamentos o where o.organization_id = p_org and o.id = p_orcamento;
  if v_doc is null then
    return;
  end if;
  update public.clinic_documentos_emitidos
     set status = 'cancelado', motivo = left(coalesce(nullif(btrim(p_motivo), ''), 'Orçamento encerrado'), 300)
   where organization_id = p_org and id = v_doc and status = 'emitido';
  update public.clinic_documento_links set expira_em = least(expira_em, now())
   where documento_id = v_doc and usado_em is null;
end $$;
revoke execute on function public.fn_clinic_orcamento_cancelar_contrato(uuid, uuid, text) from public, anon, authenticated;

-- ─── enviar: congela e emite o contrato ────────────────────────────────────
-- O texto (p_conteudo) é montado pelo servidor a partir do próprio orçamento
-- (rota /enviar); o corpo da requisição só escolhe o orçamento e o modelo.
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

-- ─── recusar (o paciente disse não) ────────────────────────────────────────
create or replace function public.fn_clinic_orcamento_recusar(p_org uuid, p_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform public.fn_clinic_orcamentos_exigir(p_org, 'orcamentos.criar');
  if v_motivo is null or char_length(v_motivo) not between 3 and 300 then
    raise exception 'orcamento_sem_motivo' using errcode = '22023';
  end if;
  update public.clinic_orcamentos set
    status = 'recusado', recusado_em = now(), motivo_recusa = v_motivo, updated_by = auth.uid(), updated_at = now()
   where organization_id = p_org and id = p_id and status = 'enviado';
  if not found then
    raise exception 'orcamento_nao_editavel' using errcode = '55000';
  end if;
  perform public.fn_clinic_orcamento_cancelar_contrato(p_org, p_id, 'Orçamento recusado pelo paciente');
  return jsonb_build_object('id', p_id);
end $$;
revoke execute on function public.fn_clinic_orcamento_recusar(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_orcamento_recusar(uuid, uuid, text) to authenticated;

-- ─── cancelar: agora também o enviado (o contrato é cancelado junto) ───────
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
   where organization_id = p_org and id = p_id and status in ('rascunho', 'enviado');
  if not found then
    raise exception 'orcamento_nao_editavel' using errcode = '55000';
  end if;
  perform public.fn_clinic_orcamento_cancelar_contrato(p_org, p_id, 'Orçamento cancelado pela clínica');
  return jsonb_build_object('id', p_id);
end $$;
revoke execute on function public.fn_clinic_orcamento_cancelar(uuid, uuid, text) from public, anon;
grant  execute on function public.fn_clinic_orcamento_cancelar(uuid, uuid, text) to authenticated;

-- ─── nova versão: revisar o que já foi enviado, recusado ou expirou ─────────
-- Copia itens e condições para um RASCUNHO com o mesmo número e versão + 1.
-- O enviado vira "substituído" e o contrato dele é cancelado.
create or replace function public.fn_clinic_orcamento_nova_versao(p_org uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.clinic_orcamentos;
  v_novo uuid;
  v_versao integer;
begin
  perform public.fn_clinic_orcamentos_exigir(p_org, 'orcamentos.criar');
  select * into v from public.clinic_orcamentos o where o.organization_id = p_org and o.id = p_id for update;
  if not found then
    raise exception 'orcamento_invalido' using errcode = '22023';
  end if;
  if v.status not in ('enviado', 'recusado', 'expirado') then
    raise exception 'orcamento_nao_editavel' using errcode = '55000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('clinic_orcamento_numero:' || p_org, 0));
  if exists (select 1 from public.clinic_orcamentos o
              where o.organization_id = p_org and o.numero = v.numero and o.status in ('rascunho', 'enviado', 'aprovado')
                and o.id <> p_id) then
    raise exception 'orcamento_versao_aberta' using errcode = '22023';
  end if;
  select max(o.versao) + 1 into v_versao from public.clinic_orcamentos o where o.organization_id = p_org and o.numero = v.numero;

  insert into public.clinic_orcamentos (organization_id, contact_id, atendimento_id, profissional_user_id, numero, versao,
                                        substitui_id, subtotal_cents, desconto_cents, total_cents, desconto_pendente,
                                        condicao_pagamento, validade_ate, observacao, created_by, updated_by)
  values (p_org, v.contact_id, v.atendimento_id, v.profissional_user_id, v.numero, v_versao, v.id,
          v.subtotal_cents, v.desconto_cents, v.total_cents,
          -- o desconto volta a passar pela régua ao salvar; aqui herda a decisão anterior
          false,
          v.condicao_pagamento, greatest(v.validade_ate, current_date + 15), v.observacao, auth.uid(), auth.uid())
  returning id into v_novo;
  insert into public.clinic_orcamento_itens (organization_id, orcamento_id, preco_id, procedure_id, event_type_id,
                                             descricao, sessoes, quantidade, preco_unit_cents, total_cents, posicao)
  select p_org, v_novo, i.preco_id, i.procedure_id, i.event_type_id, i.descricao, i.sessoes, i.quantidade,
         i.preco_unit_cents, i.total_cents, i.posicao
    from public.clinic_orcamento_itens i
   where i.organization_id = p_org and i.orcamento_id = p_id;

  if v.status = 'enviado' then
    update public.clinic_orcamentos set status = 'substituido', updated_by = auth.uid(), updated_at = now()
     where organization_id = p_org and id = p_id;
    perform public.fn_clinic_orcamento_cancelar_contrato(p_org, p_id, 'Substituído por nova versão do orçamento');
  end if;
  return jsonb_build_object('id', v_novo, 'numero', v.numero, 'versao', v_versao);
end $$;
revoke execute on function public.fn_clinic_orcamento_nova_versao(uuid, uuid) from public, anon;
grant  execute on function public.fn_clinic_orcamento_nova_versao(uuid, uuid) to authenticated;

-- ─── expirar (cron, só service role) ───────────────────────────────────────
create or replace function public.fn_clinic_orcamentos_expirar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_n integer := 0;
begin
  for r in
    select o.organization_id, o.id from public.clinic_orcamentos o
     where o.status = 'enviado' and o.validade_ate < current_date
     for update skip locked
  loop
    update public.clinic_orcamentos set status = 'expirado', expirado_em = now(), updated_at = now()
     where organization_id = r.organization_id and id = r.id;
    perform public.fn_clinic_orcamento_cancelar_contrato(r.organization_id, r.id, 'Orçamento expirado');
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('expirados', v_n);
end $$;
revoke execute on function public.fn_clinic_orcamentos_expirar() from public, anon, authenticated;
grant  execute on function public.fn_clinic_orcamentos_expirar() to service_role;
