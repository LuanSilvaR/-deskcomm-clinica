-- 8023 · clinic (FORK) — lembrete de consulta pela Meta, com reserva pelo QR code (issue #83).
--
-- Colunas aditivas e a opção por organização (nasce desligada):
--   * meta_templates ganha unique (organization_id, id) — alvo da FK composta;
--   * calendar_event_types.reminder_meta_template_id — o modelo aprovado do lembrete
--     (FK composta: o modelo é da mesma organização; apagar o modelo zera só a coluna);
--   * calendar_appointments.reminder_tentativas (degrau em minutos -> nº de tentativas),
--     reminder_falha (motivo visível na tela) e reminder_falha_at;
--   * fn_clinic_definir_lembrete_com_reserva(p_org, p_ligado) grava
--     settings.clinic.lembrete_com_reserva (mesmas guardas da confirmação automática).
-- Idempotente.

do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.meta_templates'::regclass
       and conname = 'meta_templates_org_id_key'
  ) then
    alter table public.meta_templates
      add constraint meta_templates_org_id_key unique (organization_id, id);
  end if;
end $$;

alter table public.calendar_event_types
  add column if not exists reminder_meta_template_id uuid;

alter table public.calendar_event_types
  drop constraint if exists calendar_event_types_reminder_meta_template_fk;
alter table public.calendar_event_types
  add constraint calendar_event_types_reminder_meta_template_fk
  foreign key (organization_id, reminder_meta_template_id)
  references public.meta_templates (organization_id, id)
  on delete set null (reminder_meta_template_id)
  deferrable initially deferred;

alter table public.calendar_appointments
  add column if not exists reminder_tentativas jsonb not null default '{}'::jsonb,
  add column if not exists reminder_falha text,
  add column if not exists reminder_falha_at timestamptz;

alter table public.calendar_appointments
  drop constraint if exists calendar_appointments_reminder_falha_check;
alter table public.calendar_appointments
  add constraint calendar_appointments_reminder_falha_check
  check (reminder_falha is null or reminder_falha in
    ('sem_caminho', 'fora_do_horario', 'meta_sem_modelo', 'erro_apos_tentativas', 'envio_nao_confirmado'));

create or replace function public.fn_clinic_definir_lembrete_com_reserva(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'lembrete_com_reserva') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('lembrete_com_reserva', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;

revoke execute on function public.fn_clinic_definir_lembrete_com_reserva(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_lembrete_com_reserva(uuid, boolean) to authenticated;
