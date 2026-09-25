-- ════════════════════════════════════════════════════════════════════════════
-- 9015 · clinic — Procedimentos e POP (procedimento operacional padrão) (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- O banco guarda o que o sistema CONTROLA; o texto do POP é UM documento por
-- versão (jsonb do editor), sem tabela por seção.
--
--   clinic_procedures               catálogo de procedimentos da clínica
--   clinic_procedure_specialties    × especialidades JÁ existentes (9001)
--   clinic_procedure_professionals  × profissionais JÁ existentes (9001)
--   clinic_pops                     a identidade do documento (1 por procedimento)
--   clinic_pop_versions             as versões: draft → approved → superseded
--
-- Regras no BANCO (a rota repete para dar a mensagem certa):
--   • FKs compostas (organization_id, id): nada se liga entre empresas;
--   • profissional vinculado precisa ter uma das especialidades do procedimento;
--   • versão aprovada é imutável; só rascunho se apaga; status e aprovação só
--     mudam pelas funções fn_pop_* (que conferem a permissão);
--   • um rascunho e uma aprovada por POP.
-- ACL: procedimentos.ver/gerenciar, pops.ver/editar/aprovar/imprimir — no
-- catálogo, no Administrador de toda empresa e nos papéis-modelo pelo nível.
-- A tela nasce desligada: settings.clinic.procedimentos.
-- Idempotente.

-- ─── alvos das FKs compostas (aditivo: id já é único) ───────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_specialties_org_id_key') then
    alter table public.clinic_specialties add constraint clinic_specialties_org_id_key unique (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinic_professionals_org_id_key') then
    alter table public.clinic_professionals add constraint clinic_professionals_org_id_key unique (organization_id, id);
  end if;
end $$;

-- ─── procedimentos ──────────────────────────────────────────────────────────
create table if not exists public.clinic_procedures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  short_description text not null,
  description text,
  duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  constraint clinic_procedures_org_id_key unique (organization_id, id),
  constraint clinic_procedures_nome_tamanho check (char_length(btrim(name)) between 1 and 120),
  constraint clinic_procedures_codigo_tamanho check (code is null or char_length(btrim(code)) between 1 and 30),
  constraint clinic_procedures_breve_tamanho check (char_length(btrim(short_description)) between 1 and 240),
  constraint clinic_procedures_descricao_tamanho check (description is null or char_length(description) <= 4000),
  constraint clinic_procedures_duracao check (duration_minutes is null or duration_minutes between 5 and 600)
);
create unique index if not exists clinic_procedures_nome_idx on public.clinic_procedures (organization_id, lower(btrim(name)));
create unique index if not exists clinic_procedures_codigo_idx
  on public.clinic_procedures (organization_id, lower(btrim(code))) where code is not null;

create table if not exists public.clinic_procedure_specialties (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedure_id uuid not null,
  specialty_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (procedure_id, specialty_id),
  constraint clinic_procedure_specialties_procedimento_fk
    foreign key (organization_id, procedure_id) references public.clinic_procedures (organization_id, id) on delete cascade,
  constraint clinic_procedure_specialties_especialidade_fk
    foreign key (organization_id, specialty_id) references public.clinic_specialties (organization_id, id) on delete cascade
);
create index if not exists clinic_procedure_specialties_org_idx on public.clinic_procedure_specialties (organization_id, specialty_id);

create table if not exists public.clinic_procedure_professionals (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedure_id uuid not null,
  professional_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (procedure_id, professional_id),
  constraint clinic_procedure_professionals_procedimento_fk
    foreign key (organization_id, procedure_id) references public.clinic_procedures (organization_id, id) on delete cascade,
  constraint clinic_procedure_professionals_profissional_fk
    foreign key (organization_id, professional_id) references public.clinic_professionals (organization_id, id) on delete cascade
);
create index if not exists clinic_procedure_professionals_org_idx on public.clinic_procedure_professionals (organization_id, professional_id);

-- ─── POP ────────────────────────────────────────────────────────────────────
create table if not exists public.clinic_pops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedure_id uuid not null,
  code text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  constraint clinic_pops_org_id_key unique (organization_id, id),
  constraint clinic_pops_procedimento_key unique (procedure_id),
  constraint clinic_pops_procedimento_fk
    foreign key (organization_id, procedure_id) references public.clinic_procedures (organization_id, id),
  constraint clinic_pops_codigo_tamanho check (char_length(btrim(code)) between 1 and 30)
);
create unique index if not exists clinic_pops_codigo_idx on public.clinic_pops (organization_id, lower(btrim(code)));

create table if not exists public.clinic_pop_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pop_id uuid not null,
  major integer not null default 1,
  minor integer not null default 0,
  status text not null default 'draft',
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_text text not null default '',
  revision_reason text,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  superseded_at timestamptz,
  constraint clinic_pop_versions_org_id_key unique (organization_id, id),
  constraint clinic_pop_versions_numero_key unique (pop_id, major, minor),
  constraint clinic_pop_versions_pop_fk
    foreign key (organization_id, pop_id) references public.clinic_pops (organization_id, id),
  constraint clinic_pop_versions_status_check check (status in ('draft','approved','superseded','archived')),
  constraint clinic_pop_versions_numero_check check (major >= 1 and minor >= 0),
  constraint clinic_pop_versions_documento_check
    check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 1048576),
  constraint clinic_pop_versions_motivo_tamanho check (revision_reason is null or char_length(revision_reason) <= 500),
  constraint clinic_pop_versions_aprovacao_check
    check ((status = 'draft') = (approved_at is null) or status = 'archived')
);
create unique index if not exists clinic_pop_versions_um_rascunho on public.clinic_pop_versions (pop_id) where status = 'draft';
create unique index if not exists clinic_pop_versions_uma_aprovada on public.clinic_pop_versions (pop_id) where status = 'approved';
create index if not exists clinic_pop_versions_org_idx on public.clinic_pop_versions (organization_id, pop_id);

-- ─── quem e quando alterou ──────────────────────────────────────────────────
create or replace function public.fn_clinic_carimbar_alteracao()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
revoke execute on function public.fn_clinic_carimbar_alteracao() from public, anon, authenticated;

drop trigger if exists clinic_procedures_carimbo on public.clinic_procedures;
create trigger clinic_procedures_carimbo before update on public.clinic_procedures
  for each row execute function public.fn_clinic_carimbar_alteracao();

-- ─── coerência: profissional vinculado tem uma das especialidades ──────────
create or replace function public.fn_clinic_procedimento_profissional_coerente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.clinic_procedure_specialties ps where ps.procedure_id = new.procedure_id)
     and not exists (
       select 1
         from public.clinic_procedure_specialties ps
         join public.clinic_professional_specialties pr
           on pr.specialty_id = ps.specialty_id and pr.professional_id = new.professional_id
        where ps.procedure_id = new.procedure_id) then
    raise exception 'procedimento_profissional_sem_especialidade' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_procedimento_profissional_coerente() from public, anon, authenticated;

drop trigger if exists clinic_procedure_professionals_coerencia on public.clinic_procedure_professionals;
create trigger clinic_procedure_professionals_coerencia
  before insert or update on public.clinic_procedure_professionals
  for each row execute function public.fn_clinic_procedimento_profissional_coerente();

-- ─── imutabilidade da versão ───────────────────────────────────────────────
-- Fora das funções fn_pop_* (que ligam `clinic.pop_transicao`), só se mexe no
-- CONTEÚDO de um rascunho. Aprovada: nada muda além de virar superseded/archived
-- (e isso só pela função). Só rascunho se apaga.
create or replace function public.fn_clinic_pop_versao_guarda()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_transicao boolean := coalesce(current_setting('clinic.pop_transicao', true), '') = '1';
begin
  if tg_op = 'DELETE' then
    -- Aprovada não se apaga — exceto quando a EMPRESA inteira está sendo
    -- excluída (cascata de organizations): aí não há o que preservar.
    if old.status <> 'draft'
       and exists (select 1 from public.organizations o where o.id = old.organization_id) then
      raise exception 'pop_versao_imutavel' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if not v_transicao and (new.status <> 'draft' or new.approved_at is not null or new.approved_by is not null) then
      raise exception 'pop_transicao_so_pela_funcao' using errcode = '42501';
    end if;
    return new;
  end if;
  -- UPDATE
  if old.status <> 'draft' then
    if not v_transicao
       or new.content is distinct from old.content
       or new.content_text is distinct from old.content_text
       or new.major <> old.major or new.minor <> old.minor
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by then
      raise exception 'pop_versao_imutavel' using errcode = '42501';
    end if;
    return new;
  end if;
  if not v_transicao
     and (new.status <> old.status or new.approved_at is distinct from old.approved_at
          or new.approved_by is distinct from old.approved_by
          or new.major <> old.major or new.minor <> old.minor or new.pop_id <> old.pop_id) then
    raise exception 'pop_transicao_so_pela_funcao' using errcode = '42501';
  end if;
  if new.content is distinct from old.content or new.content_text is distinct from old.content_text then
    new.lock_version := old.lock_version + 1;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_pop_versao_guarda() from public, anon, authenticated;

drop trigger if exists clinic_pop_versions_guarda on public.clinic_pop_versions;
create trigger clinic_pop_versions_guarda
  before insert or update or delete on public.clinic_pop_versions
  for each row execute function public.fn_clinic_pop_versao_guarda();

-- ─── RLS: empresa + permissão ──────────────────────────────────────────────
-- tenant_isolation_<t>_all (regra 3) + restritivas por permissão (padrão 9013).
do $rls$
declare
  r record;
begin
  for r in
    select * from (values
      ('clinic_procedures',               'procedimentos.ver', 'procedimentos.gerenciar'),
      ('clinic_procedure_specialties',    'procedimentos.ver', 'procedimentos.gerenciar'),
      ('clinic_procedure_professionals',  'procedimentos.ver', 'procedimentos.gerenciar'),
      ('clinic_pops',                     'pops.ver',          'pops.editar'),
      ('clinic_pop_versions',             'pops.ver',          'pops.editar')
    ) as t(tabela, ler, escrever)
  loop
    execute format('alter table public.%I enable row level security', r.tabela);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', r.tabela, r.tabela);
    -- fn_role_at_least(viewer) = qualquer membro; está aqui porque a cerca 0150
    -- (rbac-config-ia-canais) recusa policy ALL só-tenancy em tabela nova.
    execute format($p$create policy tenant_isolation_%s_all on public.%I
        using (public.fn_is_platform_admin()
               or ((organization_id in (select public.fn_user_org_ids()))
                   and public.fn_role_at_least(organization_id, 'viewer')))
        with check (public.fn_is_platform_admin()
               or ((organization_id in (select public.fn_user_org_ids()))
                   and public.fn_role_at_least(organization_id, 'viewer')))$p$,
      r.tabela, r.tabela);
    execute format('drop policy if exists acesso_ler on public.%I', r.tabela);
    execute format('drop policy if exists acesso_inserir on public.%I', r.tabela);
    execute format('drop policy if exists acesso_alterar on public.%I', r.tabela);
    execute format('drop policy if exists acesso_excluir on public.%I', r.tabela);
    execute format($p$create policy acesso_ler on public.%I as restrictive for select
                      using (public.fn_is_platform_admin() or public.fn_has_permission(organization_id, %L))$p$, r.tabela, r.ler);
    execute format($p$create policy acesso_inserir on public.%I as restrictive for insert
                      with check (public.fn_support_write_allowed(organization_id)
                                  and (public.fn_is_platform_admin() or public.fn_has_permission(organization_id, %L)))$p$, r.tabela, r.escrever);
    execute format($p$create policy acesso_alterar on public.%I as restrictive for update
                      using (public.fn_support_write_allowed(organization_id)
                             and (public.fn_is_platform_admin() or public.fn_has_permission(organization_id, %L)))
                      with check (public.fn_support_write_allowed(organization_id)
                                  and (public.fn_is_platform_admin() or public.fn_has_permission(organization_id, %L)))$p$,
      r.tabela, r.escrever, r.escrever);
    execute format($p$create policy acesso_excluir on public.%I as restrictive for delete
                      using (public.fn_support_write_allowed(organization_id)
                             and (public.fn_is_platform_admin() or public.fn_has_permission(organization_id, %L)))$p$, r.tabela, r.escrever);
    execute format('revoke all on public.%I from anon', r.tabela);
  end loop;
end
$rls$;

-- ─── funções do POP (as transições) ────────────────────────────────────────
-- Criar: POP + versão 1.0 em rascunho. Código "POP-001" se não vier.
create or replace function public.fn_pop_criar(p_procedure uuid, p_code text, p_content jsonb, p_content_text text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_code text := nullif(btrim(coalesce(p_code, '')), '');
  v_pop uuid;
  v_versao uuid;
  v_seq integer;
begin
  select organization_id into v_org from public.clinic_procedures where id = p_procedure;
  if v_org is null or v_org not in (select public.fn_user_org_ids()) then
    raise exception 'procedimento_nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.fn_acesso_exigir(v_org, 'pops.editar');
  perform pg_advisory_xact_lock(hashtext('clinic_pop:' || v_org::text));
  if exists (select 1 from public.clinic_pops where procedure_id = p_procedure) then
    raise exception 'pop_ja_existe' using errcode = '23505';
  end if;
  if v_code is null then
    select coalesce(max((regexp_match(code, '^POP-(\d+)$'))[1]::int), 0) + 1 into v_seq
      from public.clinic_pops where organization_id = v_org;
    v_code := 'POP-' || lpad(v_seq::text, 3, '0');
  end if;
  insert into public.clinic_pops (organization_id, procedure_id, code, created_by)
    values (v_org, p_procedure, v_code, auth.uid()) returning id into v_pop;
  insert into public.clinic_pop_versions (organization_id, pop_id, major, minor, status, content, content_text, created_by, updated_by)
    values (v_org, v_pop, 1, 0, 'draft', coalesce(p_content, '{"type":"doc","content":[]}'::jsonb), coalesce(p_content_text, ''), auth.uid(), auth.uid())
    returning id into v_versao;
  return jsonb_build_object('pop_id', v_pop, 'versao_id', v_versao, 'codigo', v_code);
end $$;
revoke execute on function public.fn_pop_criar(uuid, text, jsonb, text) from public, anon;
grant  execute on function public.fn_pop_criar(uuid, text, jsonb, text) to authenticated;

-- Aprovar: o rascunho vira a vigente; a vigente anterior vira substituída.
create or replace function public.fn_pop_aprovar(p_versao uuid, p_lock integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
  v_anterior uuid;
begin
  select * into v from public.clinic_pop_versions where id = p_versao;
  if v.id is null or v.organization_id not in (select public.fn_user_org_ids()) then
    raise exception 'pop_versao_nao_encontrada' using errcode = 'P0002';
  end if;
  perform public.fn_acesso_exigir(v.organization_id, 'pops.aprovar');
  perform pg_advisory_xact_lock(hashtext('clinic_pop:' || v.pop_id::text));
  select * into v from public.clinic_pop_versions where id = p_versao for update;
  if v.status <> 'draft' then
    raise exception 'pop_versao_nao_e_rascunho' using errcode = '23514';
  end if;
  if p_lock is not null and p_lock <> v.lock_version then
    raise exception 'pop_editado_por_outra_pessoa' using errcode = '40001';
  end if;
  perform set_config('clinic.pop_transicao', '1', true);
  update public.clinic_pop_versions
     set status = 'superseded', superseded_at = now()
   where pop_id = v.pop_id and status = 'approved'
   returning id into v_anterior;
  update public.clinic_pop_versions
     set status = 'approved', approved_at = now(), approved_by = auth.uid()
   where id = p_versao;
  perform set_config('clinic.pop_transicao', '', true);
  return jsonb_build_object('versao_id', p_versao, 'substituida_id', v_anterior);
end $$;
revoke execute on function public.fn_pop_aprovar(uuid, integer) from public, anon;
grant  execute on function public.fn_pop_aprovar(uuid, integer) to authenticated;

-- Nova versão: copia a vigente para um rascunho 1.x (ou (x+1).0 se maior).
create or replace function public.fn_pop_nova_versao(p_pop uuid, p_maior boolean, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_vigente record;
  v_max_major integer;
  v_max_minor integer;
  v_major integer;
  v_minor integer;
  v_id uuid;
begin
  select organization_id into v_org from public.clinic_pops where id = p_pop;
  if v_org is null or v_org not in (select public.fn_user_org_ids()) then
    raise exception 'pop_nao_encontrado' using errcode = 'P0002';
  end if;
  perform public.fn_acesso_exigir(v_org, 'pops.editar');
  perform pg_advisory_xact_lock(hashtext('clinic_pop:' || p_pop::text));
  if exists (select 1 from public.clinic_pop_versions where pop_id = p_pop and status = 'draft') then
    raise exception 'pop_ja_tem_rascunho' using errcode = '23505';
  end if;
  select * into v_vigente from public.clinic_pop_versions where pop_id = p_pop and status = 'approved';
  if v_vigente.id is null then
    raise exception 'pop_sem_versao_aprovada' using errcode = '23514';
  end if;
  select max(major) into v_max_major from public.clinic_pop_versions where pop_id = p_pop;
  if coalesce(p_maior, false) then
    v_major := v_max_major + 1;
    v_minor := 0;
  else
    v_major := v_max_major;
    select max(minor) into v_max_minor from public.clinic_pop_versions where pop_id = p_pop and major = v_max_major;
    v_minor := v_max_minor + 1;
  end if;
  insert into public.clinic_pop_versions
    (organization_id, pop_id, major, minor, status, content, content_text, revision_reason, created_by, updated_by)
  values
    (v_org, p_pop, v_major, v_minor, 'draft', v_vigente.content, v_vigente.content_text,
     nullif(btrim(coalesce(p_motivo, '')), ''), auth.uid(), auth.uid())
  returning id into v_id;
  return jsonb_build_object('versao_id', v_id, 'major', v_major, 'minor', v_minor);
end $$;
revoke execute on function public.fn_pop_nova_versao(uuid, boolean, text) from public, anon;
grant  execute on function public.fn_pop_nova_versao(uuid, boolean, text) to authenticated;

-- ─── as permissões novas: catálogo + Administrador + papéis-modelo ─────────
insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao) values
  ('procedimentos.ver', 'procedimentos', 'ver', 'viewer', array[]::text[], false, 'Ver procedimentos, especialidades e profissionais vinculados'),
  ('procedimentos.gerenciar', 'procedimentos', 'gerenciar', 'manager', array['procedimentos.ver']::text[], false, 'Cadastrar, alterar, ativar e desativar procedimentos e vínculos'),
  ('pops.ver', 'pops', 'ver', 'viewer', array['procedimentos.ver']::text[], false, 'Ver o POP vigente e o histórico de versões'),
  ('pops.editar', 'pops', 'editar', 'manager', array['pops.ver']::text[], false, 'Criar POP, editar rascunho e criar nova versão'),
  ('pops.aprovar', 'pops', 'aprovar', 'manager', array['pops.ver']::text[], true, 'Aprovar uma versão do POP'),
  ('pops.imprimir', 'pops', 'imprimir', 'viewer', array['pops.ver']::text[], false, 'Imprimir o POP (PDF)')
on conflict (key) do update
  set modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
      depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao;

-- Administrador: todas. Modelos (gerente/atendente/visualizador): pelo nível.
insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
select r.organization_id, r.id, p.key
  from public.clinic_roles r
  join public.clinic_permissions p on p.modulo in ('procedimentos', 'pops')
 where r.system_key = 'administrador'
    or (r.system_key = 'gerente' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('manager'))
    or (r.system_key = 'atendente' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('agent'))
    or (r.system_key = 'visualizador' and public.fn_nivel_rank(p.nivel_base) <= public.fn_nivel_rank('viewer'))
on conflict do nothing;

-- ─── a opção: settings.clinic.procedimentos (nasce desligada) ──────────────
create or replace function public.fn_clinic_definir_procedimentos(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'procedimentos') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('procedimentos', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;
revoke execute on function public.fn_clinic_definir_procedimentos(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_procedimentos(uuid, boolean) to authenticated;
