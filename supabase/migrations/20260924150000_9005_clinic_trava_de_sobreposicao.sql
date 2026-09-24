-- ════════════════════════════════════════════════════════════════════════════
-- 9005 · clinic — trava de sobreposição na agenda (FORK)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Hoje a conferência de horário ocupado mora só no código (lê, decide, grava):
-- a recepção e o agente de IA marcando o mesmo horário no mesmo instante passam
-- os dois. Com `organizations.settings.clinic.trava_sobreposicao` ligada (nasce
-- DESLIGADA), o banco recusa o segundo com `23P01` ("agenda_horario_indisponivel"),
-- que o handler de agendamentos devolve como o mesmo 422 de sempre.
--
-- ═══ POR QUE TRIGGER, E NÃO `exclude using gist` ═══
--   1. A sincronização do Google (`source = 'google_sync'`) ESPELHA eventos que
--      já existem lá fora — e eventos do Google se sobrepõem. Uma constraint
--      recusaria o espelho e quebraria a sincronização.
--   2. Um banco que já tem sobreposição (encaixe antigo, importação) faria o
--      `create constraint` falhar no `update.sh` de quem atualiza.
--   3. A trava é por ORGANIZAÇÃO (opção), e constraint não lê settings.
--
-- ═══ A CORRIDA ═══
-- `pg_advisory_xact_lock` por (organização, profissional) serializa quem grava
-- na agenda da mesma pessoa. Em READ COMMITTED cada comando de uma função
-- VOLATILE tira snapshot novo: quem esperou o lock enxerga a linha que o
-- primeiro acabou de gravar e recusa. Provado com duas sessões simultâneas em
-- tests/invariants/clinic-trava-de-sobreposicao.test.ts.
--
-- Ocupam: pending, confirmed, completed (a mesma régua de lib/agenda/ocupados.ts:
-- cancelled e no_show liberam). Encostar não é ocupar (fim = início).
-- UPDATE que não muda horário, profissional nem passa a ocupar (ex.: pending →
-- confirmed) não é conferido: sobreposição ANTIGA não trava a operação de hoje.
-- Idempotente.

create or replace function public.fn_clinic_trava_sobreposicao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ligada boolean;
begin
  if new.owner_user_id is null
     or new.status not in ('pending','confirmed','completed')
     or new.source = 'google_sync' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.starts_at = old.starts_at
     and new.ends_at = old.ends_at
     and new.owner_user_id is not distinct from old.owner_user_id
     and old.status in ('pending','confirmed','completed') then
    return new;
  end if;

  select (o.settings -> 'clinic' -> 'trava_sobreposicao') = 'true'::jsonb into v_ligada
    from public.organizations o
   where o.id = new.organization_id;
  if not coalesce(v_ligada, false) then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('clinic_agenda:' || new.organization_id::text || ':' || new.owner_user_id::text, 0));

  if exists (
    select 1
      from public.calendar_appointments a
     where a.organization_id = new.organization_id
       and a.owner_user_id = new.owner_user_id
       and a.id <> new.id
       and a.status in ('pending','confirmed','completed')
       and a.starts_at < new.ends_at
       and a.ends_at > new.starts_at
  ) then
    raise exception 'agenda_horario_indisponivel'
      using errcode = '23P01',
            detail = 'Outro compromisso ocupa este horário na agenda deste profissional.';
  end if;
  return new;
end $$;

revoke execute on function public.fn_clinic_trava_sobreposicao() from public, anon, authenticated;

drop trigger if exists trg_clinic_trava_sobreposicao on public.calendar_appointments;
create trigger trg_clinic_trava_sobreposicao
  before insert or update of starts_at, ends_at, owner_user_id, status
  on public.calendar_appointments
  for each row execute function public.fn_clinic_trava_sobreposicao();

-- ─── a opção: organizations.settings.clinic.trava_sobreposicao ────────────
create or replace function public.fn_clinic_definir_trava_sobreposicao(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'trava_sobreposicao') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('trava_sobreposicao', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;

revoke execute on function public.fn_clinic_definir_trava_sobreposicao(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_trava_sobreposicao(uuid, boolean) to authenticated;
