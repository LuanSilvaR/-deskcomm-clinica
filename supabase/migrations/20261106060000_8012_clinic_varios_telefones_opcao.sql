-- 8012 · clinic (FORK) — opção dos vários telefones na ficha (#85, upstream #3671)
-- Liga/desliga settings.clinic.varios_telefones (nasce desligada). Ligada, a ficha
-- do paciente deixa adicionar e remover telefones extras (`contact_phones`, 8011).
-- Desligada, a ficha só MOSTRA os extras que já existem (ex.: vindos da junção de
-- fichas). Aditiva; sem tabela; sem HTTP.

-- Mesmo molde de fn_clinic_definir_encaixe (9046): admin + MFA provado.
create or replace function public.fn_clinic_definir_varios_telefones(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'varios_telefones') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('varios_telefones', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;
revoke execute on function public.fn_clinic_definir_varios_telefones(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_varios_telefones(uuid, boolean) to authenticated;
