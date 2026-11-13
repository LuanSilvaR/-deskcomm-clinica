-- ════════════════════════════════════════════════════════════════════════════
-- 8026 · cobrança da plataforma — planos e assinaturas (FORK, épico #158, card #159)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ORIGEM: absorve do upstream (melgarafael/DeskcommCRM) as migrations
--   0583_cobranca_planos_e_assinaturas, 0601 (§F oferecido_ao_cliente e o link
--   de pagamento), 0641 (checkout_sessao_id) e 0679 (entrada paga / troca de
--   plano), RENUMERADAS para a faixa do fork e anotadas no UPSTREAM.md.
--
-- O QUE ENTRA AGORA (A1):
--   • `cobranca_planos` (da INSTALAÇÃO, sem organization_id; RLS sem policy,
--     só o service_role) e `cobranca_assinaturas` (uma linha por organização;
--     SEM linha = isenta). As duas com o formato do upstream inteiro, para as
--     próximas absorções (#160, #162) caírem sem nova forma de tabela.
--   • `fn_cobranca_ligada()`: só `platform_config.MODULO_COBRANCA = 'ligado'`
--     liga. DESLIGADA POR PADRÃO: sem a linha, nada muda para ninguém.
--   • teste grátis na criação da org (gatilho), só com a chave ligada, só para
--     org criada por quem NÃO é admin de plataforma, só se houver plano do
--     cadastro. Tenants que já existem ficam ISENTOS (sem linha).
--   • `fn_create_tenant_with_owner` UNIFICADA: corpo do fork (0237: criador
--     provisório, `settings.plan` sempre gravado; #154: o pacote da clínica é
--     aplicado pela rota) + o `plano_id` do upstream (0583/0679).
--
-- O QUE FICA DE FORA (de propósito, cartões próprios):
--   • `fn_limite_do_plano` e as travas de assentos/canais/IA → #162;
--   • suspensão/reativação por cobrança, webhook, régua → #160. Por isso o
--     plano com 0 dia de teste grava `pagamento_inicial_pendente` mas NÃO
--     suspende aqui (o fork não tem `fn_suspender_organizacao`);
--   • o upstream APAGAVA `organizations.ai_budget_cents/rate_limit_rps`. O fork
--     não apaga coluna (CLAUDE.md, regra 1): elas ficam.
-- Aditiva, idempotente, sem HTTP. Toda função perde EXECUTE de public/anon/authenticated.

-- ─── A. as duas tabelas, vazias ─────────────────────────────────────────────
create table if not exists public.cobranca_planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 60),
  preco_cents bigint not null check (preco_cents >= 500),
  moeda text not null default 'BRL' check (moeda = any (array['BRL'::text])),
  intervalo text not null check (intervalo in ('mes', 'ano')),
  trial_dias integer not null default 14 check (trial_dias between 0 and 90),
  max_assentos integer check (max_assentos >= 1),
  max_canais integer check (max_canais >= 1),
  teto_ia_usd_cents integer check (teto_ia_usd_cents >= 100),
  padrao_no_cadastro boolean not null default false,
  oferecido_ao_cliente boolean not null default true,
  arquivado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.cobranca_planos is
  'Planos que a dona da plataforma vende às clínicas (fork 8026, origem upstream 0583). Da INSTALAÇÃO, sem organization_id: RLS ligada sem policy, só o service_role. Limite nulo = sem limite. preco_cents >= 500 (mínimo de boleto); moeda só BRL.';

create unique index if not exists cobranca_planos_um_padrao
  on public.cobranca_planos ((true)) where padrao_no_cadastro and arquivado_em is null;

alter table public.cobranca_planos enable row level security;
revoke all on public.cobranca_planos from anon, authenticated;
grant select, insert, update, delete on public.cobranca_planos to service_role;

drop trigger if exists trg_cobranca_planos_touch on public.cobranca_planos;
create trigger trg_cobranca_planos_touch
  before update on public.cobranca_planos
  for each row execute function public.fn_touch_updated_at();

create table if not exists public.cobranca_assinaturas (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plano_id uuid not null references public.cobranca_planos(id) on delete restrict,
  plano_agendado_id uuid references public.cobranca_planos(id) on delete restrict,
  estado text not null default 'trial' check (estado in ('trial', 'ativa', 'em_atraso', 'cancelada')),
  trial_ate timestamptz,
  provedor text check (provedor in ('stripe', 'asaas')),
  modo text check (modo in ('teste', 'producao')),
  provedor_cliente_id text,
  provedor_assinatura_id text,
  vencida_desde timestamptz,
  proximo_vencimento timestamptz,
  cancela_no_fim boolean not null default false,
  prazo_extra_ate timestamptz,
  ultimo_aviso text check (ultimo_aviso in ('trial_acabando', 'venceu', 'suspende_em_breve', 'suspensa')),
  ultimo_aviso_em timestamptz,
  checkout_url text,
  checkout_expira_em timestamptz,
  checkout_sessao_id text,
  link_de_pagamento text,
  relida_em timestamptz,
  assinaturas_vivas integer not null default 0,
  ultimo_erro text check (ultimo_erro in ('credencial_invalida', 'provedor_fora', 'pagamento_de_assinatura_cancelada', 'leitura_invalida')),
  ultimo_erro_em timestamptz,
  pagamento_inicial_pendente boolean not null default false,
  periodo_pago_desde timestamptz,
  plano_troca_pendente_id uuid references public.cobranca_planos(id) on delete restrict,
  troca_id uuid,
  troca_valor_cents integer,
  troca_status text check (troca_status is null or troca_status in ('criando', 'aguardando_pagamento', 'pago')),
  troca_pagamento_ref text,
  troca_pagamento_url text,
  troca_reserva_ate timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cobranca_assinaturas_provedor_e_cliente_juntos
    check ((provedor is null) = (provedor_cliente_id is null))
);
comment on table public.cobranca_assinaturas is
  'Assinatura de cada clínica (fork 8026, origem upstream 0583/0601/0641/0679): uma linha por org; SEM linha = isenta. CPF/CNPJ nunca é guardado aqui. Leitura: admin da própria org; escrita: só service_role.';

create unique index if not exists cobranca_assinaturas_cliente
  on public.cobranca_assinaturas (provedor, provedor_cliente_id) where provedor is not null;
create index if not exists cobranca_assinaturas_plano_idx on public.cobranca_assinaturas (plano_id);

alter table public.cobranca_assinaturas enable row level security;
drop policy if exists tenant_isolation_cobranca_assinaturas_select on public.cobranca_assinaturas;
create policy tenant_isolation_cobranca_assinaturas_select on public.cobranca_assinaturas
  for select to authenticated
  using ((organization_id in (select public.fn_user_org_ids())) and public.fn_role_at_least(organization_id, 'admin'));
revoke all on public.cobranca_assinaturas from anon, authenticated;
grant select on public.cobranca_assinaturas to authenticated;
grant select, insert, update, delete on public.cobranca_assinaturas to service_role;

drop trigger if exists trg_cobranca_assinaturas_touch on public.cobranca_assinaturas;
create trigger trg_cobranca_assinaturas_touch
  before update on public.cobranca_assinaturas
  for each row execute function public.fn_touch_updated_at();

-- ─── B. a chave da instalação ───────────────────────────────────────────────
-- Só `ligado` liga, como em lib/instalacao/modulos.ts (linha ausente = desligada).
create or replace function public.fn_cobranca_ligada()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_config c
     where c.chave = 'MODULO_COBRANCA' and c.valor = 'ligado'
  );
$$;
revoke execute on function public.fn_cobranca_ligada() from public, anon, authenticated;
grant execute on function public.fn_cobranca_ligada() to service_role;

-- ─── C. teste grátis na criação da org ──────────────────────────────────────
-- Só com a chave ligada; org criada por admin de plataforma recebe o plano do
-- FORMULÁRIO (fn_create_tenant_with_owner), não o do cadastro.
create or replace function public.fn_trial_na_criacao_da_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plano_id   uuid;
  v_trial_dias integer;
begin
  if new.created_by is null or not public.fn_cobranca_ligada() then
    return null;
  end if;
  if exists (select 1 from public.platform_admins pa
              where pa.user_id = new.created_by and pa.revoked_at is null) then
    return null;
  end if;
  select p.id, p.trial_dias into v_plano_id, v_trial_dias
    from public.cobranca_planos p
   where p.padrao_no_cadastro and p.arquivado_em is null;
  if v_plano_id is null then
    return null;
  end if;
  insert into public.cobranca_assinaturas (organization_id, plano_id, estado, trial_ate, pagamento_inicial_pendente)
  values (new.id, v_plano_id, 'trial', now() + make_interval(days => v_trial_dias), v_trial_dias = 0)
  on conflict (organization_id) do nothing;
  return null;
end;
$$;
revoke execute on function public.fn_trial_na_criacao_da_org() from public, anon, authenticated;
drop trigger if exists trg_trial_na_criacao_da_org on public.organizations;
create trigger trg_trial_na_criacao_da_org
  after insert on public.organizations
  for each row execute function public.fn_trial_na_criacao_da_org();

-- ─── D. fn_create_tenant_with_owner UNIFICADA ───────────────────────────────
-- Corpo da 0237 do fork (criador provisório quando o dono é outra pessoa,
-- settings.plan sempre gravado) + `plano_id` do upstream (0583/0679): com a
-- chave desligada, plano_id é recusado; plano arquivado também. Sem plano_id,
-- o tenant nasce ISENTO (sem linha de assinatura), como hoje.
create or replace function public.fn_create_tenant_with_owner(
  p_actor uuid, p_key uuid, p_request jsonb, p_hash text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  prior public.idempotency_keys%rowtype;
  org public.organizations%rowtype;
  result jsonb;
  dono_e_outra_pessoa boolean;
  v_plano_id uuid;
  v_trial_dias integer;
begin
  if not exists (select 1 from public.platform_admins where user_id = p_actor
    and revoked_at is null and scope = 'full') then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text || ':' || p_key::text, 0));
  select * into prior from public.idempotency_keys
    where key = p_key::text and endpoint = '/api/v1/admin/tenants:' || p_actor::text
      and expires_at > now() and tenant_creation_trusted;
  if found then
    if prior.request_hash <> decode(p_hash, 'hex') then
      raise exception 'idempotency_conflict' using errcode = '22023';
    end if;
    if prior.response_body->>'id' is distinct from prior.organization_id::text
      or not exists (select 1 from public.organizations where id = prior.organization_id and created_by = p_actor) then
      raise exception 'idempotency_provenance_invalid' using errcode = '22023';
    end if;
    return prior.response_body || jsonb_build_object('created', false);
  end if;

  -- (upstream 0583/0679) o plano escolhido no formulário.
  begin
    v_plano_id := nullif(p_request->>'plano_id', '')::uuid;
  exception when others then
    raise exception 'plano_invalido' using errcode = '22023';
  end;
  if v_plano_id is not null then
    if not public.fn_cobranca_ligada() then
      raise exception 'cobranca_desligada' using errcode = '22023';
    end if;
    select p.trial_dias into v_trial_dias
      from public.cobranca_planos p
     where p.id = v_plano_id and p.arquivado_em is null;
    if not found then
      raise exception 'plano_invalido' using errcode = '22023';
    end if;
  end if;

  -- (fork 0237) a MESMA comparação que decide `interface_settings`.
  dono_e_outra_pessoa := lower(p_request->>'owner_email') is distinct from
    (select lower(email) from auth.users where id = p_actor);

  insert into public.organizations(display_name, slug, legal_name, cnpj, status, settings, created_by)
    values (p_request->>'display_name', p_request->>'slug', coalesce(nullif(p_request->>'legal_name', ''), p_request->>'display_name'),
      p_request->>'cnpj', 'active', jsonb_build_object('plan', p_request->>'plan'), p_actor)
    returning * into org;
  insert into public.user_organizations(organization_id, user_id, role, accepted_at, interface_settings, provisional_until_handover)
    values (org.id, p_actor, 'admin', now(),
      case when dono_e_outra_pessoa
        then '{"preset":"completa"}'::jsonb
        else coalesce(p_request->'owner_interface_settings', '{"preset":"completa"}'::jsonb) end,
      dono_e_outra_pessoa);

  if v_plano_id is not null then
    -- 0 dia de teste = entrada paga: marcado aqui; a suspensão até o 1º
    -- pagamento chega com o provedor (#160).
    insert into public.cobranca_assinaturas
      (organization_id, plano_id, estado, trial_ate, pagamento_inicial_pendente)
    values (org.id, v_plano_id, 'trial', now() + make_interval(days => v_trial_dias), v_trial_dias = 0)
    on conflict (organization_id) do nothing;
  end if;

  result := jsonb_build_object('id', org.id, 'slug', org.slug, 'display_name', org.display_name,
    'invite_id', gen_random_uuid(), 'issued_at', floor(extract(epoch from now()))::bigint);
  insert into public.idempotency_keys(organization_id, key, endpoint, request_hash, status_code, response_body, tenant_creation_trusted)
    values (org.id, p_key::text, '/api/v1/admin/tenants:' || p_actor::text,
      decode(p_hash, 'hex'), 201, result, true);
  return result || jsonb_build_object('created', true);
end $$;

revoke all on function public.fn_create_tenant_with_owner(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.fn_create_tenant_with_owner(uuid, uuid, jsonb, text) to service_role;

notify pgrst, 'reload schema';
