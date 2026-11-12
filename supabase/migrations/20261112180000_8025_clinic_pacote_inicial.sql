-- 8025 · clinic (FORK) — clínica criada pelo /admin já nasce com os módulos de clínica (#154)
-- Função que aplica o PACOTE INICIAL de clínica em `settings.clinic` de uma
-- organização recém-criada. Quem chama é o servidor (service role), logo após
-- `fn_create_tenant_with_owner` criar a organização — nunca o usuário.
-- Exceção consciente à regra "feature nova nasce desligada": vale só para a
-- organização NOVA criada como clínica; nenhuma organização existente muda.
-- Chave já presente em settings.clinic VENCE o pacote (nunca sobrescreve).
-- Aditiva e idempotente; sem HTTP.

create or replace function public.fn_clinic_aplicar_pacote_inicial(p_org uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_pacote constant jsonb := jsonb_build_object(
    'menu_clinica', true,
    'profissionais', true,
    'procedimentos', true,
    'prontuario', true,
    'estoque', true,
    'orcamentos', true,
    'recursos', true,
    'encaixe', true,
    'trava_sobreposicao', true
  );
  v_clinic jsonb;
begin
  if p_org is null then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  update public.organizations
     set settings = jsonb_set(
           coalesce(settings, '{}'::jsonb),
           '{clinic}',
           v_pacote
             || (case when jsonb_typeof(settings -> 'clinic') = 'object' then settings -> 'clinic' else '{}'::jsonb end),
           true)
   where id = p_org
  returning settings -> 'clinic' into v_clinic;

  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
  return v_clinic;
end $$;
revoke execute on function public.fn_clinic_aplicar_pacote_inicial(uuid) from public, anon, authenticated;
grant  execute on function public.fn_clinic_aplicar_pacote_inicial(uuid) to service_role;
