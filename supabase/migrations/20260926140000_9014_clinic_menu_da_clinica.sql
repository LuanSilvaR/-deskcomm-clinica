-- ════════════════════════════════════════════════════════════════════════════
-- 9014 · clinic — menu organizado por módulos da clínica (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- `organizations.settings.clinic.menu_clinica` (nasce DESLIGADA). Ligada, a
-- casca desenha o menu por módulos da clínica (Início, Agenda, Pacientes,
-- Financeiro...) em vez dos grupos de CRM. É APRESENTAÇÃO: nenhuma tela, rota,
-- permissão ou policy muda — quem vê o quê continua decidido por `minRole`,
-- `permissao` e pela RLS. Desligar volta ao menu de antes.
--
-- Só esta função nova. Mesmos moldes de `fn_clinic_definir_recursos` (9007):
-- admin da própria organização, suporte com escrita e MFA comprovado.
-- Idempotente.

create or replace function public.fn_clinic_definir_menu_clinica(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'menu_clinica') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('menu_clinica', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;

revoke execute on function public.fn_clinic_definir_menu_clinica(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_menu_clinica(uuid, boolean) to authenticated;
