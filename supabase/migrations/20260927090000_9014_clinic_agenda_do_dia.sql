-- ════════════════════════════════════════════════════════════════════════════
-- 9014 · clinic — opção "Agenda do dia" (FORK, plano de UX da agenda)
-- ════════════════════════════════════════════════════════════════════════════
--
-- A tela /app/agenda/dia (lista por profissional com status da visita,
-- ocupação e filtros) nasce DESLIGADA por empresa:
-- organizations.settings.clinic.agenda_do_dia. Só a tela lê a opção; nenhum
-- dado muda. Mesmo contrato das outras opções da clínica (9001, 9005, 9007):
-- admin, suporte com escrita, MFA; devolve { ligado, mudou }. Idempotente.

create or replace function public.fn_clinic_definir_agenda_do_dia(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'agenda_do_dia') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('agenda_do_dia', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;

revoke execute on function public.fn_clinic_definir_agenda_do_dia(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_agenda_do_dia(uuid, boolean) to authenticated;
