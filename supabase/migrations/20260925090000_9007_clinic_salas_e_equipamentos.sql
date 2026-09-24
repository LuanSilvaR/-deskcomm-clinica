-- ════════════════════════════════════════════════════════════════════════════
-- 9007 · clinic — salas e equipamentos (FORK, épico E4.2)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Dois profissionais livres não bastam quando há uma sala só, e o laser não
-- está em dois procedimentos ao mesmo tempo. Com
-- `organizations.settings.clinic.recursos` ligada (nasce DESLIGADA):
--
--   clinic_resources               — salas e equipamentos (nome + categoria)
--   clinic_event_type_resources    — o que cada tipo de atendimento exige:
--                                    "uma de <categoria>" OU "este recurso"
--   clinic_appointment_resources   — o que cada compromisso ocupa (alocação)
--
-- A OFERTA (lib/clinic/agenda/recursos.ts) só mostra horário em que cada
-- exigência tem recurso livre. A ALOCAÇÃO é deste trigger, no MESMO comando do
-- INSERT/UPDATE do compromisso: sem recurso livre, o compromisso inteiro é
-- recusado com 23P01 (`recurso_indisponivel`), que o handler já devolve como
-- 422 `agenda_horario_indisponivel` (9005). `pg_advisory_xact_lock` por
-- organização fecha a corrida entre duas marcações.
--
-- Cancelar ou registrar falta LIBERA o recurso (sempre, mesmo com a opção
-- desligada — alocação velha não pode segurar sala). O espelho do Google não
-- aloca. UPDATE que não muda horário, tipo nem passa a ocupar não realoca:
-- confirmar ou marcar "Compareceu" não pode falhar por causa de sala.
-- Idempotente.

-- ─── recursos ──────────────────────────────────────────────────────────────
create table if not exists public.clinic_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_resources_nome_tamanho check (char_length(btrim(name)) between 1 and 80),
  constraint clinic_resources_categoria_tamanho check (char_length(btrim(category)) between 1 and 40)
);
create unique index if not exists clinic_resources_org_nome_key
  on public.clinic_resources (organization_id, lower(btrim(name)));
create index if not exists clinic_resources_org_categoria_idx
  on public.clinic_resources (organization_id, lower(btrim(category))) where is_active;

-- ─── o que o tipo de atendimento exige ─────────────────────────────────────
create table if not exists public.clinic_event_type_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type_id uuid not null references public.calendar_event_types(id) on delete cascade,
  category text,
  resource_id uuid references public.clinic_resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint clinic_event_type_resources_um_dos_dois
    check ((category is null) <> (resource_id is null)),
  constraint clinic_event_type_resources_categoria_tamanho
    check (category is null or char_length(btrim(category)) between 1 and 40)
);
create index if not exists clinic_event_type_resources_tipo_idx
  on public.clinic_event_type_resources (organization_id, event_type_id);

-- ─── o que cada compromisso ocupa ──────────────────────────────────────────
create table if not exists public.clinic_appointment_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.calendar_appointments(id) on delete cascade,
  resource_id uuid not null references public.clinic_resources(id) on delete cascade,
  -- Copiados do compromisso (DIRC: duplicar): a conferência de "livre" é por
  -- recurso e janela, e juntar com calendar_appointments a cada marcação seria
  -- o caminho quente mais caro da agenda. Quem mantém é o trigger abaixo.
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint clinic_appointment_resources_periodo check (ends_at > starts_at),
  constraint clinic_appointment_resources_um_por_recurso unique (appointment_id, resource_id)
);
create index if not exists clinic_appointment_resources_recurso_idx
  on public.clinic_appointment_resources (resource_id, starts_at, ends_at);
create index if not exists clinic_appointment_resources_org_idx
  on public.clinic_appointment_resources (organization_id, starts_at);

drop trigger if exists clinic_resources_updated_at on public.clinic_resources;
create trigger clinic_resources_updated_at before update on public.clinic_resources
  for each row execute function public.fn_set_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Recursos e exigências: leitura da organização, escrita a partir de gerente
-- (é configuração). Alocação: só leitura — quem escreve é o trigger.
do $$
declare t text;
begin
  foreach t in array array['clinic_resources','clinic_event_type_resources','clinic_appointment_resources'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format('drop policy if exists %s_select on public.%I', t, t);
    execute format($p$create policy %s_select on public.%I for select using (
        (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin())$p$, t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
  foreach t in array array['clinic_resources','clinic_event_type_resources'] loop
    execute format('drop policy if exists %s_write on public.%I', t, t);
    execute format($p$create policy %s_write on public.%I
        using (public.fn_is_platform_admin()
               or ((organization_id in (select public.fn_user_org_ids()))
                   and public.fn_role_at_least(organization_id, 'manager')))
        with check (public.fn_is_platform_admin()
               or ((organization_id in (select public.fn_user_org_ids()))
                   and public.fn_role_at_least(organization_id, 'manager')))$p$, t, t);
  end loop;
end $$;
revoke insert, update, delete, truncate on public.clinic_appointment_resources from authenticated;

-- ─── a alocação ────────────────────────────────────────────────────────────
create or replace function public.fn_clinic_alocar_recursos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ligado boolean;
  r record;
  v_recurso uuid;
begin
  if tg_op = 'UPDATE'
     and new.starts_at = old.starts_at
     and new.ends_at = old.ends_at
     and new.event_type_id is not distinct from old.event_type_id
     and (new.status in ('pending','confirmed','completed')) = (old.status in ('pending','confirmed','completed')) then
    return null;
  end if;

  delete from public.clinic_appointment_resources where appointment_id = new.id;

  if new.status not in ('pending','confirmed','completed')
     or new.source = 'google_sync'
     or new.event_type_id is null then
    return null;
  end if;

  select (o.settings -> 'clinic' -> 'recursos') = 'true'::jsonb into v_ligado
    from public.organizations o
   where o.id = new.organization_id;
  if not coalesce(v_ligado, false) then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('clinic_recursos:' || new.organization_id::text, 0));

  for r in
    select e.category, e.resource_id
      from public.clinic_event_type_resources e
     where e.organization_id = new.organization_id
       and e.event_type_id = new.event_type_id
     order by e.resource_id nulls last, e.id
  loop
    v_recurso := null;
    select x.id into v_recurso
      from public.clinic_resources x
     where x.organization_id = new.organization_id
       and x.is_active
       and (case when r.resource_id is not null then x.id = r.resource_id
                 else lower(btrim(x.category)) = lower(btrim(r.category)) end)
       and not exists (
         select 1 from public.clinic_appointment_resources a
          where a.resource_id = x.id
            and a.starts_at < new.ends_at
            and a.ends_at > new.starts_at)
     order by x.name, x.id
     limit 1;
    if v_recurso is null then
      raise exception 'recurso_indisponivel'
        using errcode = '23P01',
              detail = case when r.category is not null
                            then 'Nenhum recurso de "' || r.category || '" está livre neste horário.'
                            else 'O equipamento exigido não está livre neste horário.' end;
    end if;
    insert into public.clinic_appointment_resources (organization_id, appointment_id, resource_id, starts_at, ends_at)
    values (new.organization_id, new.id, v_recurso, new.starts_at, new.ends_at);
  end loop;
  return null;
end $$;

revoke execute on function public.fn_clinic_alocar_recursos() from public, anon, authenticated;

drop trigger if exists trg_clinic_alocar_recursos on public.calendar_appointments;
create trigger trg_clinic_alocar_recursos
  after insert or update of starts_at, ends_at, status, event_type_id
  on public.calendar_appointments
  for each row execute function public.fn_clinic_alocar_recursos();

-- ─── a opção: organizations.settings.clinic.recursos ──────────────────────
create or replace function public.fn_clinic_definir_recursos(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'recursos') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('recursos', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;

revoke execute on function public.fn_clinic_definir_recursos(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_recursos(uuid, boolean) to authenticated;
