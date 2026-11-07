-- 8012 · clinic (FORK) — favicon da empresa (Configurações › Marca)
-- O ícone da aba do navegador dentro de /app. O arquivo mora no bucket
-- `brand-logos` (mesmo bucket, mesmas garantias do logo: só service_role
-- escreve, caminho <org>/<uuid v4>.png não-enumerável, bytes farejados na rota).
-- O ponteiro fica em settings.clinic.favicon_path, e NÃO em settings.branding:
-- fn_definir_marca_da_organizacao (núcleo) regrava o objeto branding inteiro
-- preservando só logo_path — um favicon ali sumiria a cada "Salvar" da marca.
-- Aditiva; sem tabela; sem policy; sem HTTP.

create or replace function public.fn_clinic_definir_favicon(
  p_org   uuid,
  p_actor uuid,
  p_path  text
) returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
  v_path   text;
begin
  if p_org is null or p_actor is null then
    raise exception 'favicon_argumento_nulo' using errcode = '22023';
  end if;

  v_path := nullif(btrim(coalesce(p_path, '')), '');
  -- Só PNG, e só dentro do prefixo da PRÓPRIA organização.
  if v_path is not null
     and v_path !~ ('^' || p_org::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$')
  then
    raise exception 'favicon_caminho_fora_do_escopo' using errcode = '22023';
  end if;

  -- Mesmo gate do logo da organização: admin ativo dela, ou dono da instalação.
  if not exists (
       select 1 from public.user_organizations uo
        where uo.user_id = p_actor
          and uo.organization_id = p_org
          and uo.role = 'admin'
          and uo.revoked_at is null
     )
     and not exists (
       select 1 from public.platform_admins pa
        where pa.user_id = p_actor
          and pa.revoked_at is null
     )
  then
    raise exception 'favicon_sem_permissao' using errcode = '42501';
  end if;

  update public.organizations o
     set settings = jsonb_set(
           coalesce(o.settings, '{}'::jsonb),
           '{clinic}',
           case
             when v_path is null
               then (case when jsonb_typeof(o.settings -> 'clinic') = 'object'
                          then o.settings -> 'clinic' else '{}'::jsonb end) - 'favicon_path'
             else (case when jsonb_typeof(o.settings -> 'clinic') = 'object'
                        then o.settings -> 'clinic' else '{}'::jsonb end)
                  || jsonb_build_object('favicon_path', v_path)
           end,
           true)
   where o.id = p_org;
  get diagnostics v_linhas = row_count;
  return v_linhas;
end;
$$;

comment on function public.fn_clinic_definir_favicon(uuid, uuid, text) is
  'FORK clinic 8012 — grava (ou apaga) organizations.settings.clinic.favicon_path com merge no campo. Só PNG no prefixo da própria organização (22023 fora disso); admin da organização ou dono da instalação (42501 fora disso). Devolve linhas afetadas. Chamador: app/api/v1/clinic/marca/favicon/route.ts.';

-- Definer VOLÁTIL: só o service_role (a rota, depois dos gates) executa.
revoke execute on function public.fn_clinic_definir_favicon(uuid, uuid, text)
  from public, anon, authenticated;
grant  execute on function public.fn_clinic_definir_favicon(uuid, uuid, text)
  to service_role;
