-- ════════════════════════════════════════════════════════════════════════════
-- 8028 · cobrança da plataforma — a régua: suspensão tipada, avisos e
--        reconciliação (FORK, épico #158, card #160, parte 160c)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ORIGEM: absorve do upstream o essencial da 0501 (suspensão TIPADA) e as
-- seções §C/§D/§E da 0601, RENUMERADAS para a faixa do fork (UPSTREAM.md).
--
-- A. `organizations.suspended_kind` ('administrativa' | 'cobranca'). Backfill:
--    toda suspensa hoje vira 'administrativa' (foi o admin quem suspendeu). A
--    régua de cobrança NUNCA reativa uma suspensão administrativa.
-- B. `fn_suspender_organizacao` / `fn_reativar_organizacao`: uma transação, lock
--    na linha, exigem o tipo. Administrativa prevalece sobre cobrança. Mesmo
--    efeito da rota de suspensão do fork (status, carimbos e o evento
--    `tenant.suspended`/`tenant.reactivated` no event_log). DIFERENÇA do
--    upstream: o fork não descarta a fila de jobs na suspensão (a rota do fork
--    não descartava; fica para card próprio).
-- C. `agent_inbox_items.kind` ganha 'cobranca' (bloco único do baseline e lista
--    COMPLETA aqui — kind-check-migration-x-baseline): os avisos da régua
--    aparecem na Central para quem administra a empresa.
-- D. `fn_cobranca_reconciliaveis()`: quem o cron relê no provedor.
-- E. `fn_cobranca_registrar_aviso` (o aviso e o item da Central na mesma
--    transação; o mesmo aviso da mesma dívida ganha uma vez só) e
--    `fn_cobranca_suspender_se_devendo` (trava a linha e só suspende quem AINDA
--    deve: o pagamento gravado no meio vence) e `fn_cobranca_avisar_teto_de_ia`
--    (aviso de 80% do teto de IA do plano, um por org por mês, na Central).
--
-- Idempotente; sem BEGIN/COMMIT. Toda função nova perde EXECUTE de public, anon
-- e authenticated; só service_role executa. Sem HTTP em gatilho/função.
-- Gate: tests/invariants/cobranca-regua-e-suspensao.test.ts.

-- ── A ──────────────────────────────────────────────────────────────────────
alter table public.organizations add column if not exists suspended_kind text;

update public.organizations
   set suspended_kind = 'administrativa'
 where status = 'suspended'
   and suspended_kind is null;

alter table public.organizations
  drop constraint if exists organizations_suspended_kind_check;
alter table public.organizations
  add constraint organizations_suspended_kind_check check (suspended_kind in ('administrativa', 'cobranca'));

comment on column public.organizations.suspended_kind is
  'Por que a organização está suspensa: administrativa (admin da plataforma) ou cobranca (régua de cobrança). Só vale com status = suspended. Escrito por fn_suspender_organizacao/fn_reativar_organizacao e pela rota de suspensão do admin (migration 8028, fork).';

-- ── B ──────────────────────────────────────────────────────────────────────
create or replace function public.fn_suspender_organizacao(
  p_org uuid, p_kind text, p_motivo text, p_ator uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_kind   text;
begin
  if p_kind is null or p_kind not in ('administrativa', 'cobranca') then
    raise exception 'tipo_de_suspensao_invalido' using errcode = '22023';
  end if;

  select o.status, coalesce(o.suspended_kind, 'administrativa')
    into v_status, v_kind
    from public.organizations o
   where o.id = p_org
     for update;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  if v_status = 'suspended' then
    if v_kind = p_kind then
      return jsonb_build_object('changed', false, 'motivo', 'ja_suspensa');
    end if;
    if p_kind = 'cobranca' then
      return jsonb_build_object('changed', false, 'motivo', 'administrativa_prevalece');
    end if;
    update public.organizations
       set suspended_kind = 'administrativa', suspended_reason = p_motivo, suspended_by = p_ator, updated_at = now()
     where id = p_org;
  elsif v_status = 'active' then
    update public.organizations
       set status = 'suspended', suspended_kind = p_kind, suspended_reason = p_motivo,
           suspended_at = now(), suspended_by = p_ator, updated_at = now()
     where id = p_org;
  else
    return jsonb_build_object('changed', false, 'motivo', 'org_encerrada');
  end if;

  insert into public.event_log (organization_id, event_type, entity_kind, entity_id, payload)
  values (p_org, 'tenant.suspended', 'organization', p_org,
          jsonb_build_object('tenant_id', p_org, 'kind', p_kind, 'suspended_by', p_ator, 'reason', p_motivo));

  return jsonb_build_object('changed', true);
end;
$$;

revoke execute on function public.fn_suspender_organizacao(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.fn_suspender_organizacao(uuid, text, text, uuid) to service_role;

create or replace function public.fn_reativar_organizacao(
  p_org uuid, p_kind_exigido text, p_ator uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_kind   text;
begin
  if p_kind_exigido is null or p_kind_exigido not in ('administrativa', 'cobranca') then
    raise exception 'tipo_de_suspensao_invalido' using errcode = '22023';
  end if;

  select o.status, coalesce(o.suspended_kind, 'administrativa')
    into v_status, v_kind
    from public.organizations o
   where o.id = p_org
     for update;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  if v_status <> 'suspended' then
    return jsonb_build_object('changed', false, 'motivo', 'nao_suspensa');
  end if;
  if v_kind <> p_kind_exigido then
    return jsonb_build_object('changed', false, 'motivo',
      case v_kind when 'cobranca' then 'suspensao_de_cobranca' else 'suspensao_administrativa' end);
  end if;

  update public.organizations
     set status = 'active', suspended_kind = null, suspended_at = null,
         suspended_reason = null, suspended_by = null, updated_at = now()
   where id = p_org;

  insert into public.event_log (organization_id, event_type, entity_kind, entity_id, payload)
  values (p_org, 'tenant.reactivated', 'organization', p_org,
          jsonb_build_object('tenant_id', p_org, 'kind', v_kind, 'reactivated_by', p_ator));

  return jsonb_build_object('changed', true);
end;
$$;

revoke execute on function public.fn_reativar_organizacao(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.fn_reativar_organizacao(uuid, text, uuid) to service_role;

-- ── C ──────────────────────────────────────────────────────────────────────
alter table public.agent_inbox_items
  drop constraint if exists agent_inbox_items_kind_check;
alter table public.agent_inbox_items
  add constraint agent_inbox_items_kind_check check (kind in (
    'appointment_outcome_required',
    'appointment_recovery_review',
    'qr_rescan',
    'routing_unassigned',
    'job_dead',
    'event_dead',
    'budget_exceeded',
    'handoff',
    'promotion_review',
    'judge_unaligned',
    'followup_dead',
    'snooze_expired',
    'next_action_ambiguous',
    'risk_backlog_seeded',
    'reactivation_expired',
    'capabilities_missing',
    'message_send_stuck',
    'midia_nao_lida',
    'channel_template_review',
    'channel_number_alert',
    'promise_unfulfilled',
    'contact_proposal_expired',
    'budget_warning',
    'conhecimento_nao_indexado',
    'voice_call_missed',
    'case_stale',
    'aviso_de_caso_nao_entregue',
    'followup_sem_agente',
    'canal_mudo_sem_numero',
    'cobranca',
    'other'
  ));

-- ── D ──────────────────────────────────────────────────────────────────────
create or replace function public.fn_cobranca_reconciliaveis()
returns table (organization_id uuid, relida_em timestamptz, precisa_reler boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.organization_id,
         a.relida_em,
         (a.relida_em is null
          or a.relida_em < now() - interval '6 hours'
          or (o.status = 'active'
              and a.ultimo_aviso = 'suspende_em_breve'
              and a.relida_em < now() - interval '1 hour')) as precisa_reler
    from public.cobranca_assinaturas a
    join public.organizations o on o.id = a.organization_id
   where a.provedor is not null
     and (a.estado <> 'cancelada'
          or (o.status = 'suspended' and o.suspended_kind = 'cobranca')
          or a.checkout_expira_em > now() - interval '30 days');
$$;

revoke execute on function public.fn_cobranca_reconciliaveis() from public, anon, authenticated;
grant execute on function public.fn_cobranca_reconciliaveis() to service_role;

-- ── E ──────────────────────────────────────────────────────────────────────
create or replace function public.fn_cobranca_registrar_aviso(
  p_org uuid, p_aviso text, p_desde timestamptz, p_titulo text, p_corpo text, p_severidade text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ganhou boolean;
begin
  update public.cobranca_assinaturas
     set ultimo_aviso = p_aviso, ultimo_aviso_em = now(), updated_at = now()
   where organization_id = p_org
     and (ultimo_aviso is distinct from p_aviso
          or ultimo_aviso_em is null
          or (p_desde is not null and ultimo_aviso_em < p_desde))
  returning true into v_ganhou;
  if not coalesce(v_ganhou, false) then
    return false;
  end if;
  update public.agent_inbox_items
     set status = 'resolved', resolved_at = now()
   where organization_id = p_org and kind = 'cobranca' and ref_kind is null and status = 'open';
  insert into public.agent_inbox_items (organization_id, kind, severity, title, body)
  values (p_org, 'cobranca', p_severidade, p_titulo, p_corpo);
  return true;
end;
$$;

revoke execute on function public.fn_cobranca_registrar_aviso(uuid, text, timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.fn_cobranca_registrar_aviso(uuid, text, timestamptz, text, text, text) to service_role;

create or replace function public.fn_cobranca_suspender_se_devendo(p_org uuid, p_motivo text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.cobranca_assinaturas
   where organization_id = p_org and estado in ('em_atraso', 'cancelada')
   for update;
  if not found then
    return jsonb_build_object('changed', false, 'motivo', 'nao_deve');
  end if;
  return public.fn_suspender_organizacao(p_org, 'cobranca', p_motivo, null);
end;
$$;

revoke execute on function public.fn_cobranca_suspender_se_devendo(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_cobranca_suspender_se_devendo(uuid, text) to service_role;

-- 80% do teto de IA do plano: um aviso por organização por mês (mês em UTC). A
-- trava consultiva por org faz do "já avisei este mês?" e do INSERT uma coisa só.
create or replace function public.fn_cobranca_avisar_teto_de_ia(p_org uuid, p_titulo text, p_corpo text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 2284));
  if exists (select 1 from public.agent_inbox_items
              where organization_id = p_org and kind = 'cobranca' and ref_kind = 'plano'
                and created_at >= date_trunc('month', now())) then
    return false;
  end if;
  insert into public.agent_inbox_items (organization_id, kind, severity, title, body, ref_kind, ref_id)
  values (p_org, 'cobranca', 'warn', p_titulo, p_corpo, 'plano', p_org);
  return true;
end;
$$;

revoke execute on function public.fn_cobranca_avisar_teto_de_ia(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fn_cobranca_avisar_teto_de_ia(uuid, text, text) to service_role;
