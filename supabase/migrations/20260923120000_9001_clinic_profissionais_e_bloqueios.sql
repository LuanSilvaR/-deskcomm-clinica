-- ════════════════════════════════════════════════════════════════════════════
-- 9001 · clinic — profissionais, especialidades e bloqueios de agenda (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Migration do fork (faixa 9xxx reservada ao fork para não colidir com a
-- numeração do upstream DeskcommCRM). Tudo aditivo: nenhuma tabela do core é
-- alterada; as tabelas novas apontam para organizations, auth.users e
-- calendar_event_types.
--
-- O QUÊ
--   clinic_specialties              — especialidades da clínica
--   clinic_professionals            — ficha do profissional (1:1 com um membro)
--   clinic_professional_specialties — o que cada profissional está habilitado a fazer
--   clinic_event_type_specialties   — o que cada tipo de atendimento exige
--                                     (sem linha = qualquer profissional)
--   clinic_agenda_blocks            — bloqueio por PERÍODO, RECORRENTE (weekdays)
--                                     e da CLÍNICA TODA (user_id null)
--   fn_clinic_definir_flag          — liga/desliga organizations.settings.clinic.profissionais
--
-- A feature nasce DESLIGADA: sem a flag, nada muda no motor da agenda.
-- Idempotente e portável (psql puro, sem BEGIN/COMMIT).

-- ─── especialidades ────────────────────────────────────────────────────────
create table if not exists public.clinic_specialties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_specialties_nome_tamanho check (char_length(btrim(name)) between 1 and 80),
  constraint clinic_specialties_cor_formato check (color is null or color ~ '^#[0-9a-fA-F]{6}$')
);
create unique index if not exists clinic_specialties_org_nome_key
  on public.clinic_specialties (organization_id, lower(btrim(name)));

-- ─── profissionais ─────────────────────────────────────────────────────────
create table if not exists public.clinic_professionals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  council text,
  council_number text,
  council_uf text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_professionals_org_user_key unique (organization_id, user_id),
  constraint clinic_professionals_conselho_check
    check (council is null or council in ('CRM','CRO','COREN','CRBM','CFF','CREFITO','outro')),
  constraint clinic_professionals_uf_formato check (council_uf is null or council_uf ~ '^[A-Z]{2}$'),
  constraint clinic_professionals_numero_tamanho
    check (council_number is null or char_length(btrim(council_number)) between 1 and 30),
  constraint clinic_professionals_nome_tamanho
    check (display_name is null or char_length(btrim(display_name)) between 1 and 120)
);

create table if not exists public.clinic_professional_specialties (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid not null references public.clinic_professionals(id) on delete cascade,
  specialty_id uuid not null references public.clinic_specialties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (professional_id, specialty_id)
);
create index if not exists clinic_professional_specialties_org_idx
  on public.clinic_professional_specialties (organization_id, specialty_id);

-- ─── o que cada tipo de atendimento exige ──────────────────────────────────
create table if not exists public.clinic_event_type_specialties (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type_id uuid not null references public.calendar_event_types(id) on delete cascade,
  specialty_id uuid not null references public.clinic_specialties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_type_id, specialty_id)
);
create index if not exists clinic_event_type_specialties_org_idx
  on public.clinic_event_type_specialties (organization_id, event_type_id);

-- ─── bloqueios de agenda ───────────────────────────────────────────────────
-- user_id NULL = a clínica toda. weekdays NULL = todos os dias do período;
-- preenchido = recorrência semanal (0=domingo … 6=sábado) dentro do período.
create table if not exists public.clinic_agenda_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  start_minute int not null default 0,
  end_minute int not null default 1440,
  weekdays smallint[],
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint clinic_agenda_blocks_periodo_valido check (ends_on >= starts_on),
  constraint clinic_agenda_blocks_periodo_maximo check (ends_on - starts_on <= 366),
  constraint clinic_agenda_blocks_faixa_valida
    check (start_minute >= 0 and end_minute <= 1440 and end_minute > start_minute),
  constraint clinic_agenda_blocks_dias_validos
    check (weekdays is null
           or (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[])),
  constraint clinic_agenda_blocks_motivo_tamanho check (reason is null or char_length(reason) <= 200)
);
create index if not exists clinic_agenda_blocks_org_periodo_idx
  on public.clinic_agenda_blocks (organization_id, starts_on, ends_on);

-- ─── updated_at ────────────────────────────────────────────────────────────
drop trigger if exists clinic_specialties_updated_at on public.clinic_specialties;
create trigger clinic_specialties_updated_at before update on public.clinic_specialties
  for each row execute function public.fn_set_updated_at();
drop trigger if exists clinic_professionals_updated_at on public.clinic_professionals;
create trigger clinic_professionals_updated_at before update on public.clinic_professionals
  for each row execute function public.fn_set_updated_at();

-- ─── RLS: leitura por quem é da organização; escrita manager+ ──────────────
-- Mesmo padrão de calendar_event_types (migration 0177).
do $rls$
declare
  t text;
begin
  foreach t in array array['clinic_specialties','clinic_professionals',
                           'clinic_professional_specialties','clinic_event_type_specialties']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format('drop policy if exists %s_select on public.%I', t, t);
    execute format($p$create policy %s_select on public.%I for select using (
        (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin())$p$, t, t);
    execute format('drop policy if exists %s_write on public.%I', t, t);
    execute format($p$create policy %s_write on public.%I
        using (public.fn_is_platform_admin()
               or ((organization_id in (select public.fn_user_org_ids()))
                   and public.fn_role_at_least(organization_id, 'manager')))
        with check (public.fn_is_platform_admin()
               or ((organization_id in (select public.fn_user_org_ids()))
                   and public.fn_role_at_least(organization_id, 'manager')))$p$, t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end
$rls$;

-- Bloqueio: a agenda é de quem a vive (espelha calendar_availability_exceptions),
-- e o bloqueio da CLÍNICA TODA (user_id null) é só de manager+.
alter table public.clinic_agenda_blocks enable row level security;
drop policy if exists tenant_isolation_clinic_agenda_blocks_all on public.clinic_agenda_blocks;
drop policy if exists clinic_agenda_blocks_select on public.clinic_agenda_blocks;
create policy clinic_agenda_blocks_select on public.clinic_agenda_blocks
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists clinic_agenda_blocks_write on public.clinic_agenda_blocks;
create policy clinic_agenda_blocks_write on public.clinic_agenda_blocks
  using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and ((user_id is not null and user_id = auth.uid())
             or public.fn_role_at_least(organization_id, 'manager')))
  )
  with check (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and ((user_id is not null and user_id = auth.uid())
             or public.fn_role_at_least(organization_id, 'manager')))
  );
revoke all on public.clinic_agenda_blocks from anon;

-- ─── a flag: organizations.settings.clinic.profissionais ───────────────────
-- Só admin liga/desliga; nunca por UPDATE direto em organizations.
create or replace function public.fn_clinic_definir_flag(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'profissionais') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('profissionais', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;

revoke execute on function public.fn_clinic_definir_flag(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_flag(uuid, boolean) to authenticated;
