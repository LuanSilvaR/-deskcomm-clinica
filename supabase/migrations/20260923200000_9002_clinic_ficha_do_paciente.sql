-- ════════════════════════════════════════════════════════════════════════════
-- 9002 · clinic — ficha cadastral do paciente e conserto da cifragem de CPF (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Faixa 9xxx reservada ao fork. Aditiva e idempotente.
--
-- 1. CONSERTO DO NÚCLEO — encrypt_cpf / decrypt_cpf
--    `lib/contacts/cpf.ts` chamava o RPC `encrypt_cpf` e o GET do contato chamava
--    `decrypt_cpf`, mas NENHUMA das duas existia no baseline: todo CPF gravado
--    falhava no CHECK `contacts_cpf_consistency` (hash sem cifra). As funções
--    recebem a CHAVE do servidor (`CPF_ENCRYPTION_KEY`) — ela nunca é gravada
--    no banco — e são `security invoker`, sem ler tabela nenhuma: sem a chave,
--    chamá-las não revela nada.
--
-- 2. clinic_patient_profiles — o que a ficha do paciente acrescenta ao contato
--    (nome, CPF, nascimento, telefone e e-mail continuam no `contacts`).
-- 3. clinic_appointment_arrivals — o registro de "Paciente chegou".
-- 4. LGPD — anonimizar o contato apaga o perfil (trigger, não lista à mão).
-- 5. Flag organizations.settings.clinic.ficha_obrigatoria (nasce desligada).

-- ─── 1. cifragem de CPF ────────────────────────────────────────────────────
create or replace function public.encrypt_cpf(p_plaintext text, p_key text)
returns bytea
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  -- O "CPF" do contato é o documento nacional do PAÍS da organização
  -- (lib/legal/perfil-do-pais.ts) e pode ter letras fora do Brasil: aqui só se
  -- exige valor não vazio; a validação por país é da aplicação.
  v_documento text := btrim(coalesce(p_plaintext, ''));
begin
  if p_key is null or length(p_key) < 16 then
    raise exception 'cpf_key_ausente' using errcode = '22023';
  end if;
  if v_documento = '' or length(v_documento) > 40 then
    raise exception 'cpf_invalido' using errcode = '22023';
  end if;
  return pgp_sym_encrypt(v_documento, p_key, 'cipher-algo=aes256');
end $$;

create or replace function public.decrypt_cpf(p_ciphertext bytea, p_key text)
returns text
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
begin
  if p_ciphertext is null then
    return null;
  end if;
  if p_key is null or length(p_key) < 16 then
    raise exception 'cpf_key_ausente' using errcode = '22023';
  end if;
  return pgp_sym_decrypt(p_ciphertext, p_key);
end $$;

revoke execute on function public.encrypt_cpf(text, text) from public, anon;
revoke execute on function public.decrypt_cpf(bytea, text) from public, anon;
grant  execute on function public.encrypt_cpf(text, text) to authenticated, service_role;
grant  execute on function public.decrypt_cpf(bytea, text) to authenticated, service_role;

-- ─── 2. perfil do paciente ─────────────────────────────────────────────────
create table if not exists public.clinic_patient_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  social_name text,
  sex text,
  rg text,
  rg_issuer text,
  rg_uf text,
  profession text,
  marital_status text,
  referral_source text,

  cep text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  uf text,
  city_ibge_code text,

  emergency_name text,
  emergency_relationship text,
  emergency_phone text,

  guardian_name text,
  guardian_cpf_encrypted bytea,
  guardian_cpf_hash text,
  guardian_relationship text,

  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint clinic_patient_profiles_org_contato_key unique (organization_id, contact_id),
  constraint clinic_patient_profiles_sexo_check
    check (sex is null or sex in ('feminino','masculino','intersexo','nao_informado')),
  constraint clinic_patient_profiles_estado_civil_check
    check (marital_status is null or marital_status in
      ('solteiro','casado','uniao_estavel','separado','divorciado','viuvo','nao_informado')),
  constraint clinic_patient_profiles_cep_formato check (cep is null or cep ~ '^\d{8}$'),
  constraint clinic_patient_profiles_uf_formato check (uf is null or uf ~ '^[A-Z]{2}$'),
  constraint clinic_patient_profiles_rg_uf_formato check (rg_uf is null or rg_uf ~ '^[A-Z]{2}$'),
  constraint clinic_patient_profiles_ibge_formato check (city_ibge_code is null or city_ibge_code ~ '^\d{7}$'),
  constraint clinic_patient_profiles_emergencia_e164
    check (emergency_phone is null or emergency_phone ~ '^\+\d{8,15}$'),
  constraint clinic_patient_profiles_cpf_responsavel_coerente
    check ((guardian_cpf_encrypted is null) = (guardian_cpf_hash is null))
);
create index if not exists clinic_patient_profiles_org_idx
  on public.clinic_patient_profiles (organization_id, contact_id);

drop trigger if exists clinic_patient_profiles_updated_at on public.clinic_patient_profiles;
create trigger clinic_patient_profiles_updated_at before update on public.clinic_patient_profiles
  for each row execute function public.fn_set_updated_at();

-- ─── 3. chegada do paciente ────────────────────────────────────────────────
create table if not exists public.clinic_appointment_arrivals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.calendar_appointments(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  arrived_at timestamptz not null default now(),
  registered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint clinic_appointment_arrivals_agendamento_key unique (appointment_id)
);
create index if not exists clinic_appointment_arrivals_org_idx
  on public.clinic_appointment_arrivals (organization_id, arrived_at desc);

-- ─── RLS: leitura por quem é da organização; escrita a partir de atendente ─
-- A recepção (papel `agent`) é quem preenche a ficha e registra a chegada.
do $rls$
declare
  t text;
begin
  foreach t in array array['clinic_patient_profiles','clinic_appointment_arrivals']
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
                   and public.fn_role_at_least(organization_id, 'agent')))
        with check (public.fn_is_platform_admin()
               or ((organization_id in (select public.fn_user_org_ids()))
                   and public.fn_role_at_least(organization_id, 'agent')))$p$, t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end
$rls$;

-- ─── 4. LGPD: anonimizar o contato apaga a ficha ───────────────────────────
-- Os três caminhos de anonimização (cascata, anonymize e redact) terminam em
-- `is_anonymized = true`; um trigger aqui alcança todos sem editar nenhum.
create or replace function public.fn_clinic_ficha_some_na_anonimizacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_anonymized is true and old.is_anonymized is distinct from true then
    delete from public.clinic_patient_profiles
     where organization_id = new.organization_id
       and contact_id = new.id;
  end if;
  return new;
end $$;

revoke execute on function public.fn_clinic_ficha_some_na_anonimizacao() from public, anon, authenticated;

drop trigger if exists trg_contacts_anonimizado_limpa_ficha_clinic on public.contacts;
create trigger trg_contacts_anonimizado_limpa_ficha_clinic
  after update of is_anonymized on public.contacts
  for each row execute function public.fn_clinic_ficha_some_na_anonimizacao();

-- ─── 5. a flag: organizations.settings.clinic.ficha_obrigatoria ───────────
create or replace function public.fn_clinic_definir_ficha_obrigatoria(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'ficha_obrigatoria') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('ficha_obrigatoria', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;

revoke execute on function public.fn_clinic_definir_ficha_obrigatoria(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_ficha_obrigatoria(uuid, boolean) to authenticated;
