-- 8003 · clinic (FORK) — opção do título livre no compromisso (#81, upstream #3775)
-- Liga/desliga settings.clinic.titulo_livre (nasce desligada). A coluna
-- calendar_appointments.title e a rota já existiam; a opção só mostra o campo
-- "Título do compromisso" na tela de marcar. Aditiva; sem tabela nova; sem HTTP.

-- Mesmo molde de fn_clinic_definir_encaixe (9046): admin + MFA provado.
create or replace function public.fn_clinic_definir_titulo_livre(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'titulo_livre') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('titulo_livre', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;
revoke execute on function public.fn_clinic_definir_titulo_livre(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_titulo_livre(uuid, boolean) to authenticated;
