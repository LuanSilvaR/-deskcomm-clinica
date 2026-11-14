-- ════════════════════════════════════════════════════════════════════════════
-- 9045 · clinic — agenda: encaixe (FORK, agenda S6b)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/agenda-s6/plano.md (passo 6) · ADR 0004.
-- Encaixe = marcar POR CIMA de outro compromisso do mesmo profissional, de
-- forma autorizada, com motivo e rastro. Só sobre pending/confirmed (realizado
-- nunca), só com a flag `settings.clinic.encaixe` ligada (nasce desligada) e só
-- para quem tem `agenda.encaixe` (gerente e administrador).
--
-- 1. Chave `agenda.encaixe` (nível manager, depende de agenda.marcar).
-- 2. `clinic_agenda_encaixes`: quem encaixou, por quê, sobre quem (append-only).
-- 3. `clinic_agenda_historico.tipo` aceita 'encaixe'.
-- 4. A trava 9005 aceita o encaixe SÓ com o GUC `clinic.encaixe_id` apontando
--    para linha de `clinic_agenda_encaixes` da MESMA transação (txid_current()).
-- 5. `fn_clinic_agenda_encaixar`: uma transação que confere tudo, grava o
--    encaixe, liga o GUC e insere o compromisso. Sem HTTP.
-- Provisionamento de empresa nova: `fn_acesso_provisionar_org` já dá a chave
-- pelo nivel_base (manager+, não clínica) — não precisa ser alterada.
-- Idempotente.

-- ─── 1. a chave ────────────────────────────────────────────────────────────────
insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao, clinica) values
  ('agenda.encaixe', 'agenda', 'encaixe', 'manager', array['agenda.marcar']::text[], false,
   'Encaixar um agendamento sobre outro compromisso do mesmo profissional (com motivo)', false)
on conflict (key) do update
  set modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
      depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao,
      clinica = excluded.clinica;

insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
select r.organization_id, r.id, 'agenda.encaixe'
  from public.clinic_roles r
 where r.system_key in ('administrador', 'gerente')
on conflict do nothing;

-- ─── 2. o registro do encaixe ──────────────────────────────────────────────────
-- appointment_id é deferrable: o encaixe é gravado ANTES do compromisso (o
-- trigger da trava precisa enxergá-lo), e a FK é conferida no fim da transação.
create table if not exists public.clinic_agenda_encaixes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.calendar_appointments(id) on delete cascade
    deferrable initially deferred,
  sobrepostos uuid[] not null,
  motivo text not null check (char_length(btrim(motivo)) between 5 and 500),
  ator uuid not null,
  txid bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists clinic_agenda_encaixes_ag_idx
  on public.clinic_agenda_encaixes (organization_id, appointment_id);
create index if not exists clinic_agenda_encaixes_data_idx
  on public.clinic_agenda_encaixes (organization_id, created_at desc);

alter table public.clinic_agenda_encaixes enable row level security;
-- Só LEITURA pela sessão: quem escreve é fn_clinic_agenda_encaixar (definer).
drop policy if exists tenant_isolation_clinic_agenda_encaixes_all on public.clinic_agenda_encaixes;
create policy tenant_isolation_clinic_agenda_encaixes_all on public.clinic_agenda_encaixes
  for select using (organization_id in (select public.fn_user_org_ids()));
revoke all on public.clinic_agenda_encaixes from anon;
revoke insert, update, delete, truncate on public.clinic_agenda_encaixes from authenticated;
revoke update, delete, truncate on public.clinic_agenda_encaixes from service_role;

-- ─── 3. histórico: tipo 'encaixe' ──────────────────────────────────────────────
alter table public.clinic_agenda_historico drop constraint if exists clinic_agenda_historico_tipo;
alter table public.clinic_agenda_historico add constraint clinic_agenda_historico_tipo check (
  tipo in ('criado', 'confirmado', 'pendente', 'remarcado', 'cancelado', 'faltou', 'realizado',
           'profissional_trocado', 'encaixe'));

-- ─── 4. a trava aceita o encaixe autorizado ────────────────────────────────────
create or replace function public.fn_clinic_trava_sobreposicao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ligada boolean;
  v_encaixe uuid;
  v_encaixe_ok boolean := false;
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
    -- 9045: encaixe autorizado = GUC da transação apontando para linha gravada
    -- por fn_clinic_agenda_encaixar nesta mesma transação, para este
    -- compromisso e esta empresa. Realizado sobreposto continua recusando.
    begin
      v_encaixe := nullif(current_setting('clinic.encaixe_id', true), '')::uuid;
    exception when others then
      v_encaixe := null;
    end;
    if v_encaixe is not null then
      select true into v_encaixe_ok
        from public.clinic_agenda_encaixes e
       where e.id = v_encaixe
         and e.txid = txid_current()
         and e.organization_id = new.organization_id
         and e.appointment_id = new.id;
      v_encaixe_ok := coalesce(v_encaixe_ok, false);
    end if;
    if v_encaixe_ok
       and new.status in ('pending','confirmed')
       and not exists (
         select 1
           from public.calendar_appointments a
          where a.organization_id = new.organization_id
            and a.owner_user_id = new.owner_user_id
            and a.id <> new.id
            and a.status = 'completed'
            and a.starts_at < new.ends_at
            and a.ends_at > new.starts_at
       ) then
      return new;
    end if;
    raise exception 'agenda_horario_indisponivel'
      using errcode = '23P01',
            detail = 'Outro compromisso ocupa este horário na agenda deste profissional.';
  end if;
  return new;
end $$;

revoke execute on function public.fn_clinic_trava_sobreposicao() from public, anon, authenticated;

-- ─── 5. a função do encaixe ────────────────────────────────────────────────────
create or replace function public.fn_clinic_agenda_encaixar(p_row jsonb, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_id uuid;
  v_enc uuid;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_row jsonb;
  v_rec public.calendar_appointments;
  v_sobre uuid[];
  v_cols text;
begin
  if auth.uid() is null then
    raise exception 'sem_permissao' using errcode = 'P0001', detail = 'sessão de pessoa obrigatória';
  end if;
  if p_row is null or jsonb_typeof(p_row) <> 'object' then
    raise exception 'encaixe_linha_invalida' using errcode = 'P0001';
  end if;
  begin
    v_org := (p_row ->> 'organization_id')::uuid;
  exception when others then
    v_org := null;
  end;
  if v_org is null or v_org not in (select public.fn_user_org_ids()) then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.fn_member_permissions(v_org) k where k = 'agenda.encaixe')
     or not public.fn_support_write_allowed(v_org) then
    raise exception 'sem_permissao' using errcode = 'P0001', detail = 'agenda.encaixe';
  end if;
  if not coalesce((select (o.settings -> 'clinic' -> 'encaixe') = 'true'::jsonb
                     from public.organizations o where o.id = v_org), false) then
    raise exception 'encaixe_desligado' using errcode = 'P0001';
  end if;
  if char_length(v_motivo) not between 5 and 500 then
    raise exception 'motivo_invalido' using errcode = 'P0001';
  end if;

  -- id e origem não vêm do corpo: o id é nosso, a origem é a tela.
  v_id := gen_random_uuid();
  v_row := p_row || jsonb_build_object('id', v_id, 'source', 'ui', 'organization_id', v_org);
  v_rec := jsonb_populate_record(null::public.calendar_appointments, v_row);
  if v_rec.owner_user_id is null or v_rec.starts_at is null or v_rec.ends_at is null
     or v_rec.ends_at <= v_rec.starts_at
     or coalesce(v_rec.status, 'confirmed') not in ('pending','confirmed') then
    raise exception 'encaixe_linha_invalida' using errcode = 'P0001';
  end if;

  -- mesma trava da agenda do profissional: o cálculo abaixo não corre com ninguém
  perform pg_advisory_xact_lock(
    hashtextextended('clinic_agenda:' || v_org::text || ':' || v_rec.owner_user_id::text, 0));

  if exists (
    select 1 from public.calendar_appointments a
     where a.organization_id = v_org and a.owner_user_id = v_rec.owner_user_id
       and a.status = 'completed'
       and a.starts_at < v_rec.ends_at and a.ends_at > v_rec.starts_at
  ) then
    raise exception 'sobreposto_finalizado' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(a.id order by a.starts_at), '{}'::uuid[]) into v_sobre
    from public.calendar_appointments a
   where a.organization_id = v_org and a.owner_user_id = v_rec.owner_user_id
     and a.status in ('pending','confirmed')
     and a.starts_at < v_rec.ends_at and a.ends_at > v_rec.starts_at;

  insert into public.clinic_agenda_encaixes (organization_id, appointment_id, sobrepostos, motivo, ator, txid)
  values (v_org, v_id, v_sobre, v_motivo, auth.uid(), txid_current())
  returning id into v_enc;

  perform set_config('clinic.encaixe_id', v_enc::text, true);

  -- só as colunas enviadas (+ id/source): o resto mantém o default da tabela
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into v_cols
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = 'calendar_appointments'
     and c.is_generated = 'NEVER'
     and v_row ? c.column_name::text;
  execute format(
    'insert into public.calendar_appointments (%1$s) select %1$s from jsonb_populate_record(null::public.calendar_appointments, $1)',
    v_cols) using v_row;

  insert into public.clinic_agenda_historico
    (organization_id, appointment_id, tipo, status_depois, inicio_depois, motivo, ator)
  values (v_org, v_id, 'encaixe', coalesce(v_rec.status, 'confirmed'), v_rec.starts_at, left(v_motivo, 500), auth.uid());

  -- o GUC não sobra para o resto da transação
  perform set_config('clinic.encaixe_id', '', true);
  return v_id;
end $$;

revoke execute on function public.fn_clinic_agenda_encaixar(jsonb, text) from public, anon;
grant  execute on function public.fn_clinic_agenda_encaixar(jsonb, text) to authenticated;
