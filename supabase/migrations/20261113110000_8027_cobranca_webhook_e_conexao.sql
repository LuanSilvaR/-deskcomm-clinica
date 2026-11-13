-- ════════════════════════════════════════════════════════════════════════════
-- 8027 · cobrança da plataforma — o aviso do provedor (webhook) e a trava da
--        exclusão (FORK, épico #158, card #160, parte 160a)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ORIGEM: absorve do upstream a migration 0601 (§A, §B e §G), RENUMERADA para a
-- faixa do fork e anotada no UPSTREAM.md. As seções §C/§D/§E (Central de
-- avisos, reconciliação, régua e suspensão) chegam no 160b/160c; a §F
-- (`oferecido_ao_cliente`) e o `link_de_pagamento` já entraram na 8026.
--
-- A. `webhook_events_log_provider_check` ganha 'stripe' e 'asaas'. Alargamento
--    puro: linha que passava continua passando. No baseline, o BLOCO ÚNICO da
--    constraint é editado (lista completa), não duplicado no apêndice.
-- B. `uniq_webhook_events_log_cobranca`: um evento de cobrança, uma linha. O
--    23505 deste índice é a idempotência da rota do webhook (aviso repetido
--    não duplica nada). A linha de cobrança nasce com organization_id NULO,
--    cabeçalhos NULOS e corpo {id,type}: invisível ao tenant pela própria
--    policy. Nenhuma linha desses provedores existia antes do CHECK acima.
-- G. A empresa com assinatura VIVA no provedor não sai do banco: apagar a
--    organização levaria `cobranca_assinaturas` em cascata e o provedor
--    seguiria cobrando sem ninguém do lado de cá para cancelar. DEFINER de
--    propósito (um admin de plataforma apagando pela sessão leria a assinatura
--    sob RLS e não a veria). Sem HTTP: só leitura de linha.
--
-- Idempotente; sem BEGIN/COMMIT. Toda função nova perde EXECUTE de public,
-- anon e authenticated. Gate: tests/invariants/cobranca-webhook-e-exclusao.test.ts.

-- ── A ──────────────────────────────────────────────────────────────────────
alter table public.webhook_events_log
  drop constraint if exists webhook_events_log_provider_check;
alter table public.webhook_events_log
  add constraint webhook_events_log_provider_check check (provider in (
    'waha', 'nuvemshop', 'generic', 'meta_cloud', 'zernio', 'datafy', 'stripe', 'asaas'
  ));

-- ── B ──────────────────────────────────────────────────────────────────────
create unique index if not exists uniq_webhook_events_log_cobranca
  on public.webhook_events_log (provider, external_id)
  where provider in ('stripe', 'asaas');

-- ── G ──────────────────────────────────────────────────────────────────────
create or replace function public.fn_cobranca_trava_exclusao_com_assinatura_viva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.cobranca_assinaturas a
     where a.organization_id = old.id
       and a.provedor is not null
       and (a.assinaturas_vivas > 1 or (a.assinaturas_vivas = 1 and not a.cancela_no_fim))
  ) then
    raise exception 'organizacao_com_assinatura_viva' using errcode = 'PT409';
  end if;
  return old;
end;
$$;

revoke execute on function public.fn_cobranca_trava_exclusao_com_assinatura_viva() from public, anon, authenticated;
grant execute on function public.fn_cobranca_trava_exclusao_com_assinatura_viva() to service_role;

drop trigger if exists trg_cobranca_trava_exclusao_com_assinatura_viva on public.organizations;
create trigger trg_cobranca_trava_exclusao_com_assinatura_viva
  before delete on public.organizations
  for each row execute function public.fn_cobranca_trava_exclusao_com_assinatura_viva();
