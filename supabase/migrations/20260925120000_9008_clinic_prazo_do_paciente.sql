-- ════════════════════════════════════════════════════════════════════════════
-- 9008 · clinic — prazo mínimo para o paciente desmarcar pelo WhatsApp (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- `organizations.settings.clinic.prazo_paciente_horas` (0 a 168; 0 ou ausente =
-- sem prazo, que é como nasce): dentro desse prazo antes da consulta, o agente
-- de IA não cancela nem remarca — ele avisa o paciente que a recepção vai falar
-- com ele. A equipe continua podendo tudo pela tela. Quem aplica a regra é o
-- handler de agendamentos (lib/clinic/agenda/prazo-do-paciente.ts), só para o
-- ator `ai_agent`.
--
-- Escrita só por esta função (admin), como as outras opções clinic: nunca
-- UPDATE direto em organizations. Idempotente.

create or replace function public.fn_clinic_definir_prazo_do_paciente(p_org uuid, p_horas integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes integer;
begin
  if auth.uid() is null
     or p_org is null
     or p_horas is null
     or not public.fn_role_at_least(p_org, 'admin')
     or not public.fn_support_write_allowed(p_org) then
    raise exception 'clinic_flag_forbidden' using errcode = '42501';
  end if;
  if p_horas < 0 or p_horas > 168 then
    raise exception 'clinic_prazo_invalido' using errcode = '22023';
  end if;
  if not public.fn_session_mfa_proven() then
    raise exception 'clinic_flag_mfa_required' using errcode = '42501';
  end if;

  select coalesce((o.settings -> 'clinic' ->> 'prazo_paciente_horas')::integer, 0) into v_antes
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
             || jsonb_build_object('prazo_paciente_horas', p_horas),
           true)
   where id = p_org;

  return jsonb_build_object('horas', p_horas, 'mudou', v_antes <> p_horas);
end $$;

revoke execute on function public.fn_clinic_definir_prazo_do_paciente(uuid, integer) from public, anon;
grant  execute on function public.fn_clinic_definir_prazo_do_paciente(uuid, integer) to authenticated;
