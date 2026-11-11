-- 8013 · clinic (FORK) — campos do papel timbrado (docs/padrao-documentos.md, fase D2)
--
-- Organização (colunas ADITIVAS e anuláveis em organizations — núcleo,
-- registrado no UPSTREAM.md; escrita pelo updateTenant, gate de admin):
--   website, whatsapp_phone, descriptor, technical_lead_name, technical_lead_registry.
-- CHECKs só valem com valor: colunas novas nascem vazias e não quebram o update.sh.
--
-- Marca: a "cor dos filetes" (accent do papel timbrado) em
-- settings.clinic.cor_filetes — fora de settings.branding porque
-- fn_definir_marca_da_organizacao regrava aquele objeto inteiro. Escritor
-- próprio, no molde do favicon (8012). Sem tabela; sem policy; sem HTTP.

alter table public.organizations
  add column if not exists website text,
  add column if not exists whatsapp_phone text,
  add column if not exists descriptor text,
  add column if not exists technical_lead_name text,
  add column if not exists technical_lead_registry text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.organizations'::regclass and conname = 'organizations_website_formato') then
    alter table public.organizations add constraint organizations_website_formato
      check (website is null or (length(website) <= 200 and website ~* '^https?://[^\s/$.?#].[^\s]*$'));
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.organizations'::regclass and conname = 'organizations_whatsapp_digitos') then
    alter table public.organizations add constraint organizations_whatsapp_digitos
      check (whatsapp_phone is null or whatsapp_phone ~ '^\d{10,13}$');
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.organizations'::regclass and conname = 'organizations_descriptor_tamanho') then
    alter table public.organizations add constraint organizations_descriptor_tamanho
      check (descriptor is null or length(descriptor) <= 60);
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.organizations'::regclass and conname = 'organizations_technical_lead_tamanho') then
    alter table public.organizations add constraint organizations_technical_lead_tamanho
      check ((technical_lead_name is null or length(technical_lead_name) <= 120)
         and (technical_lead_registry is null or length(technical_lead_registry) <= 60));
  end if;
end $$;

create or replace function public.fn_clinic_definir_cor_filetes(
  p_org   uuid,
  p_actor uuid,
  p_hex   text
) returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
  v_hex    text;
begin
  if p_org is null or p_actor is null then
    raise exception 'cor_filetes_argumento_nulo' using errcode = '22023';
  end if;
  v_hex := nullif(lower(btrim(coalesce(p_hex, ''))), '');
  if v_hex is not null and v_hex !~ '^#[0-9a-f]{6}$' then
    raise exception 'cor_filetes_invalida' using errcode = '22023';
  end if;
  if not exists (
       select 1 from public.user_organizations uo
        where uo.user_id = p_actor and uo.organization_id = p_org
          and uo.role = 'admin' and uo.revoked_at is null)
     and not exists (
       select 1 from public.platform_admins pa
        where pa.user_id = p_actor and pa.revoked_at is null)
  then
    raise exception 'cor_filetes_sem_permissao' using errcode = '42501';
  end if;

  update public.organizations o
     set settings = jsonb_set(
           coalesce(o.settings, '{}'::jsonb),
           '{clinic}',
           case
             when v_hex is null
               then (case when jsonb_typeof(o.settings -> 'clinic') = 'object'
                          then o.settings -> 'clinic' else '{}'::jsonb end) - 'cor_filetes'
             else (case when jsonb_typeof(o.settings -> 'clinic') = 'object'
                        then o.settings -> 'clinic' else '{}'::jsonb end)
                  || jsonb_build_object('cor_filetes', v_hex)
           end,
           true)
   where o.id = p_org;
  get diagnostics v_linhas = row_count;
  return v_linhas;
end;
$$;

comment on function public.fn_clinic_definir_cor_filetes(uuid, uuid, text) is
  'FORK clinic 8013 — grava (ou apaga) settings.clinic.cor_filetes (#rrggbb), a cor dos filetes do papel timbrado. Admin da organização ou dono da instalação (42501); cor inválida 22023. Chamador: app/api/v1/clinic/marca/cor-filetes/route.ts.';

revoke execute on function public.fn_clinic_definir_cor_filetes(uuid, uuid, text)
  from public, anon, authenticated;
grant  execute on function public.fn_clinic_definir_cor_filetes(uuid, uuid, text)
  to service_role;
