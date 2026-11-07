-- ════════════════════════════════════════════════════════════════════════════
-- 8006 · clinic — orçamento O1: tabela de preços com vigência (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/orcamento/plano.md (fase O1).
--
--   clinic_precos          cada linha é UMA vigência do preço de um item:
--                          procedimento (clinic_procedures) OU tipo de serviço
--                          (calendar_event_types) × nº de sessões (1 = avulso,
--                          >1 = pacote). O preço vigente é a linha mais nova
--                          com vigente_desde <= agora; `ativo = false` tira o
--                          item da tabela daí em diante.
--   clinic_precos_vigentes (view, security_invoker) o preço que vale agora.
--
-- Regras no BANCO:
--   • a tabela só ACRESCENTA: UPDATE recusado sempre; DELETE só na cascata da
--     exclusão da empresa. Mudar preço = publicar vigência nova; o orçamento
--     já enviado guarda o preço da vigência que usou (fases O2/O3);
--   • escreve só fn_clinic_preco_publicar (permissão orcamentos.precos + opção
--     ligada + MFA); authenticated só LÊ, e com orcamentos.ver;
--   • preço não é conteúdo clínico: a recepção vê sem abrir prontuário.
-- A opção nasce desligada: settings.clinic.orcamentos. Aditiva, idempotente, sem HTTP.

-- ─── preços ─────────────────────────────────────────────────────────────────
create table if not exists public.clinic_precos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedure_id uuid,
  event_type_id uuid references public.calendar_event_types(id) on delete cascade,
  sessoes integer not null default 1,
  descricao text,
  preco_cents bigint not null,
  ativo boolean not null default true,
  vigente_desde timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint clinic_precos_org_id_key unique (organization_id, id),
  constraint clinic_precos_procedure_fk foreign key (organization_id, procedure_id)
    references public.clinic_procedures (organization_id, id) on delete cascade,
  constraint clinic_precos_um_item check (num_nonnulls(procedure_id, event_type_id) = 1),
  constraint clinic_precos_sessoes check (sessoes between 1 and 100),
  constraint clinic_precos_valor check (preco_cents between 0 and 100000000),
  constraint clinic_precos_descricao check (descricao is null or char_length(btrim(descricao)) between 1 and 120)
);
create index if not exists clinic_precos_item_idx
  on public.clinic_precos (organization_id, coalesce(procedure_id, event_type_id), sessoes, vigente_desde desc, created_at desc);

-- Só acrescenta: UPDATE recusado sempre; DELETE só na cascata (profundidade > 1).
create or replace function public.fn_clinic_preco_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'preco_imutavel' using errcode = '55000';
end $$;
revoke execute on function public.fn_clinic_preco_imutavel() from public, anon, authenticated;
drop trigger if exists trg_clinic_precos_imutavel on public.clinic_precos;
create trigger trg_clinic_precos_imutavel before update or delete on public.clinic_precos
  for each row execute function public.fn_clinic_preco_imutavel();

-- ─── RLS: membro lê com orcamentos.ver; ninguém escreve direto ──────────────
alter table public.clinic_precos enable row level security;
drop policy if exists tenant_isolation_clinic_precos_all on public.clinic_precos;
create policy tenant_isolation_clinic_precos_all on public.clinic_precos
  using ((organization_id in (select public.fn_user_org_ids()))
         and public.fn_role_at_least(organization_id, 'viewer'))
  with check ((organization_id in (select public.fn_user_org_ids()))
         and public.fn_role_at_least(organization_id, 'viewer'));
drop policy if exists acesso_ler on public.clinic_precos;
create policy acesso_ler on public.clinic_precos as restrictive for select
  using (public.fn_has_permission(organization_id, 'orcamentos.ver'));
revoke all on public.clinic_precos from anon;
revoke insert, update, delete, truncate on public.clinic_precos from authenticated;
revoke update, delete, truncate on public.clinic_precos from service_role;

-- ─── o preço que vale agora ─────────────────────────────────────────────────
create or replace view public.clinic_precos_vigentes
with (security_invoker = true) as
  select v.*
    from (
      select distinct on (p.organization_id, coalesce(p.procedure_id, p.event_type_id), p.sessoes) p.*
        from public.clinic_precos p
       where p.vigente_desde <= now()
       order by p.organization_id, coalesce(p.procedure_id, p.event_type_id), p.sessoes,
                p.vigente_desde desc, p.created_at desc, p.id desc
    ) v
   where v.ativo;
revoke all on public.clinic_precos_vigentes from anon;
grant select on public.clinic_precos_vigentes to authenticated;

-- ─── permissões ─────────────────────────────────────────────────────────────
insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao, clinica) values
  ('orcamentos.ver', 'orcamentos', 'ver', 'agent', array[]::text[], false, 'Ver a tabela de preços e os orçamentos dos pacientes', false),
  ('orcamentos.precos', 'orcamentos', 'precos', 'manager', array['orcamentos.ver']::text[], false, 'Cadastrar e mudar os preços da tabela', false)
on conflict (key) do update
  set modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
      depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao,
      clinica = excluded.clinica;

-- Administrador: todas. Modelos (gerente/atendente/visualizador): pelo nível.
insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
select r.organization_id, r.id, p.key
  from public.clinic_roles r
  join public.clinic_permissions p on p.modulo = 'orcamentos'
 where r.system_key = 'administrador'
    or (r.system_key = 'gerente' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('manager'))
    or (r.system_key = 'atendente' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('agent'))
    or (r.system_key = 'visualizador' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('viewer'))
on conflict do nothing;

-- ─── a opção: settings.clinic.orcamentos (nasce desligada) ─────────────────
create or replace function public.fn_clinic_definir_orcamentos(p_org uuid, p_ligado boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes boolean;
begin
  if auth.uid() is null
     or p_org is null
     or p_ligado is null
     or not public.fn_role_at_least(p_org, 'admin')
     or not public.fn_support_write_allowed(p_org) then
    raise exception 'clinic_flag_forbidden' using errcode = '42501';
  end if;
  if not public.fn_session_mfa_proven() then
    raise exception 'clinic_flag_mfa_required' using errcode = '42501';
  end if;

  select (o.settings -> 'clinic' -> 'orcamentos') = 'true'::jsonb into v_antes
    from public.organizations o
   where o.id = p_org;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  update public.organizations
     set settings = jsonb_set(
           coalesce(settings, '{}'::jsonb),
           '{clinic}',
           (case when jsonb_typeof(settings -> 'clinic') = 'object' then settings -> 'clinic' else '{}'::jsonb end)
             || jsonb_build_object('orcamentos', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;
revoke execute on function public.fn_clinic_definir_orcamentos(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_orcamentos(uuid, boolean) to authenticated;

-- Permissão + MFA + suporte de escrita (fn_acesso_exigir) + opção ligada.
create or replace function public.fn_clinic_orcamentos_exigir(p_org uuid, p_permissao text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_acesso_exigir(p_org, p_permissao);
  if not coalesce((select (o.settings -> 'clinic' -> 'orcamentos') = 'true'::jsonb
                     from public.organizations o where o.id = p_org), false) then
    raise exception 'orcamentos_desligado' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.fn_clinic_orcamentos_exigir(uuid, text) from public, anon, authenticated;

-- ─── publicar uma vigência ──────────────────────────────────────────────────
-- p_dados: {procedure_id | event_type_id, sessoes?, preco_cents, descricao?, ativo?}.
-- Sempre INSERT: o preço antigo fica no histórico. Publicar igual ao vigente
-- não cria linha (devolve `mudou = false`).
create or replace function public.fn_clinic_preco_publicar(p_org uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proc uuid;
  v_tipo uuid;
  v_sessoes integer;
  v_preco bigint;
  v_ativo boolean;
  v_desc text;
  v_atual public.clinic_precos;
  v_id uuid;
begin
  perform public.fn_clinic_orcamentos_exigir(p_org, 'orcamentos.precos');
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'preco_dados_invalidos' using errcode = '22023';
  end if;
  begin
    v_proc := nullif(p_dados ->> 'procedure_id', '')::uuid;
    v_tipo := nullif(p_dados ->> 'event_type_id', '')::uuid;
    v_sessoes := coalesce(nullif(p_dados ->> 'sessoes', '')::integer, 1);
    v_preco := (p_dados ->> 'preco_cents')::bigint;
    v_ativo := coalesce((p_dados ->> 'ativo')::boolean, true);
  exception when others then
    raise exception 'preco_dados_invalidos' using errcode = '22023';
  end;
  v_desc := nullif(btrim(coalesce(p_dados ->> 'descricao', '')), '');
  if num_nonnulls(v_proc, v_tipo) <> 1 or v_preco is null or v_preco not between 0 and 100000000
     or v_sessoes not between 1 and 100 then
    raise exception 'preco_dados_invalidos' using errcode = '22023';
  end if;
  if v_proc is not null and not exists (
    select 1 from public.clinic_procedures c where c.id = v_proc and c.organization_id = p_org) then
    raise exception 'preco_item_invalido' using errcode = '22023';
  end if;
  if v_tipo is not null and not exists (
    select 1 from public.calendar_event_types e where e.id = v_tipo and e.organization_id = p_org) then
    raise exception 'preco_item_invalido' using errcode = '22023';
  end if;

  -- Uma publicação por item de cada vez (corrida entre duas abas).
  perform pg_advisory_xact_lock(hashtextextended('clinic_preco:' || p_org || ':' || coalesce(v_proc, v_tipo) || ':' || v_sessoes, 0));

  select * into v_atual
    from public.clinic_precos p
   where p.organization_id = p_org
     and coalesce(p.procedure_id, p.event_type_id) = coalesce(v_proc, v_tipo)
     and p.sessoes = v_sessoes
     and p.vigente_desde <= now()
   order by p.vigente_desde desc, p.created_at desc, p.id desc
   limit 1;
  if found and v_atual.preco_cents = v_preco and v_atual.ativo = v_ativo
     and v_atual.descricao is not distinct from v_desc then
    return jsonb_build_object('id', v_atual.id, 'mudou', false);
  end if;
  if not found and not v_ativo then
    raise exception 'preco_item_invalido' using errcode = '22023';
  end if;

  insert into public.clinic_precos (organization_id, procedure_id, event_type_id, sessoes, descricao, preco_cents, ativo, created_by)
  values (p_org, v_proc, v_tipo, v_sessoes, v_desc, v_preco, v_ativo, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'mudou', true, 'anterior_cents', v_atual.preco_cents);
end $$;
revoke execute on function public.fn_clinic_preco_publicar(uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_preco_publicar(uuid, jsonb) to authenticated;
