-- 8016 · clinic (FORK) — procedimentos do agendamento (Agenda S3, issue #68).
--
-- Um agendamento pode ter N procedimentos, na ordem escolhida no painel
-- "Novo agendamento". A duração NÃO é somada (decisão do dono): o fim do
-- compromisso continua o escolhido. A lista alimenta:
--   - o filtro "Procedimento" da Agenda (S2);
--   - a reserva de estoque da véspera (fn_clinic_estoque_reservar_agenda) e a
--     do atendimento (fn_clinic_estoque_reservar_atendimento), que antes só
--     liam o plano de tratamento (clinic_plano_sessoes) — agora leem os dois,
--     sem contar duas vezes o mesmo procedimento.
-- Escrita só por fn_clinic_agendamento_procedimentos_salvar (definer,
-- service_role; a rota confere a permissão e resolve a organização da sessão).
-- Aditiva e idempotente; sem HTTP.

create table if not exists public.clinic_agendamento_procedimentos (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id  uuid not null references public.calendar_appointments(id) on delete cascade,
  procedure_id    uuid not null references public.clinic_procedures(id) on delete restrict,
  ordem           smallint not null default 0 check (ordem between 0 and 49),
  created_at      timestamptz not null default now(),
  created_by      uuid,
  unique (appointment_id, procedure_id)
);
create index if not exists clinic_agendamento_procedimentos_org_ag
  on public.clinic_agendamento_procedimentos (organization_id, appointment_id);
create index if not exists clinic_agendamento_procedimentos_org_proc
  on public.clinic_agendamento_procedimentos (organization_id, procedure_id);

alter table public.clinic_agendamento_procedimentos enable row level security;
drop policy if exists tenant_isolation_clinic_agendamento_procedimentos_all on public.clinic_agendamento_procedimentos;
-- Só LEITURA pela sessão: quem escreve é fn_clinic_agendamento_procedimentos_salvar (definer).
create policy tenant_isolation_clinic_agendamento_procedimentos_all on public.clinic_agendamento_procedimentos
  for select using (organization_id in (select public.fn_user_org_ids()));
revoke all on public.clinic_agendamento_procedimentos from anon;
revoke insert, update, delete, truncate on public.clinic_agendamento_procedimentos from authenticated;
grant select on public.clinic_agendamento_procedimentos to authenticated;

create or replace function public.fn_clinic_agendamento_procedimentos_salvar(
  p_org           uuid,
  p_appointment   uuid,
  p_procedimentos uuid[],
  p_autor         uuid
) returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_total integer;
begin
  if p_org is null or p_appointment is null then
    raise exception 'agendamento_procedimentos_invalido' using errcode = '22023';
  end if;
  if coalesce(array_length(p_procedimentos, 1), 0) > 50 then
    raise exception 'agendamento_procedimentos_demais' using errcode = '22023';
  end if;
  if not exists (select 1 from public.calendar_appointments a where a.id = p_appointment and a.organization_id = p_org) then
    raise exception 'agendamento_nao_encontrado' using errcode = 'P0002';
  end if;
  if exists (select 1 from unnest(coalesce(p_procedimentos, '{}'::uuid[])) x(id)
              where not exists (select 1 from public.clinic_procedures p where p.id = x.id and p.organization_id = p_org)) then
    raise exception 'procedimento_de_outra_organizacao' using errcode = '42501';
  end if;

  delete from public.clinic_agendamento_procedimentos
   where organization_id = p_org and appointment_id = p_appointment;
  insert into public.clinic_agendamento_procedimentos (organization_id, appointment_id, procedure_id, ordem, created_by)
  select p_org, p_appointment, x.id, (min(x.n) - 1)::smallint, p_autor
    from unnest(coalesce(p_procedimentos, '{}'::uuid[])) with ordinality x(id, n)
   group by x.id;
  get diagnostics v_total = row_count;
  return v_total;
end $fn$;

comment on function public.fn_clinic_agendamento_procedimentos_salvar(uuid, uuid, uuid[], uuid) is
  'FORK clinic 8016 — troca a lista de procedimentos de um agendamento (ordem = posição no array; repetido conta uma vez). Chamador: PUT /api/v1/clinic/agendamentos/[id]/procedimentos (service role, organização da sessão, permissão conferida na rota).';
revoke execute on function public.fn_clinic_agendamento_procedimentos_salvar(uuid, uuid, uuid[], uuid) from public, anon, authenticated;
grant  execute on function public.fn_clinic_agendamento_procedimentos_salvar(uuid, uuid, uuid[], uuid) to service_role;

-- Reserva da véspera: plano de tratamento + procedimentos do agendamento.
create or replace function public.fn_clinic_estoque_reservar_agenda()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_criadas integer;
  v_expiradas integer;
begin
  update public.clinic_estoque_reservas r
     set status = 'expirada', fechada_em = now()
    from public.calendar_appointments ap
   where r.status = 'ativa' and r.atendimento_id is null and ap.id = r.appointment_id
     and (ap.status in ('cancelled', 'no_show') or ap.starts_at < now() - interval '12 hours');
  get diagnostics v_expiradas = row_count;

  insert into public.clinic_estoque_reservas (organization_id, appointment_id, product_id, local_id, quantidade)
  select s.organization_id, s.appointment_id, k.product_id,
         (select l.id from public.clinic_estoque_locais l
           where l.organization_id = s.organization_id and l.padrao and l.ativo limit 1),
         sum(k.quantidade)
    from (select ps.organization_id, ps.appointment_id, ps.procedure_id
            from public.clinic_plano_sessoes ps
           where ps.status = 'agendada' and ps.appointment_id is not null
          union
          select ap2.organization_id, ap2.appointment_id, ap2.procedure_id
            from public.clinic_agendamento_procedimentos ap2) s
    join public.calendar_appointments ap on ap.id = s.appointment_id and ap.organization_id = s.organization_id
    join public.organizations o on o.id = s.organization_id and (o.settings -> 'clinic' -> 'estoque') = 'true'::jsonb
    join public.clinic_procedimento_kits k on k.organization_id = s.organization_id and k.procedure_id = s.procedure_id
    join public.clinic_produto_estoque e on e.organization_id = s.organization_id and e.product_id = k.product_id
   where ap.status in ('pending', 'confirmed')
     and ap.starts_at between now() and now() + interval '36 hours'
     and not exists (select 1 from public.clinic_atendimentos a where a.appointment_id = ap.id)
   group by s.organization_id, s.appointment_id, k.product_id
  on conflict (organization_id, appointment_id, product_id) where status = 'ativa' and atendimento_id is null
  do update set quantidade = excluded.quantidade;
  get diagnostics v_criadas = row_count;
  return jsonb_build_object('reservadas', v_criadas, 'expiradas', v_expiradas);
end $fn$;

-- Reserva do atendimento: sem procedimento realizado, cai no plano + procedimentos do agendamento.
create or replace function public.fn_clinic_estoque_reservar_atendimento(p_org uuid, p_atendimento uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_at record;
  v_local uuid;
  v_desejada jsonb;
begin
  if not coalesce((select (o.settings -> 'clinic' -> 'estoque') = 'true'::jsonb
                     from public.organizations o where o.id = p_org), false) then
    return;
  end if;
  select a.id, a.status, a.appointment_id into v_at
    from public.clinic_atendimentos a where a.id = p_atendimento and a.organization_id = p_org;
  if v_at.id is null or v_at.status <> 'em_andamento' then
    return;
  end if;
  v_local := public.fn_clinic_estoque_local_do_atendimento(p_org, p_atendimento);

  -- as reservas da véspera passam para o atendimento
  if v_at.appointment_id is not null then
    update public.clinic_estoque_reservas r
       set status = 'convertida', fechada_em = now()
     where r.organization_id = p_org and r.appointment_id = v_at.appointment_id
       and r.atendimento_id is null and r.status = 'ativa';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('product_id', x.product_id, 'quantidade', x.quantidade)), '[]'::jsonb)
    into v_desejada
    from (select k.product_id, sum(k.quantidade) as quantidade
            from public.clinic_procedimentos_realizados p
            join public.clinic_procedimento_kits k on k.organization_id = p_org and k.procedure_id = p.procedure_id
            join public.clinic_produto_estoque e on e.organization_id = p_org and e.product_id = k.product_id
           where p.organization_id = p_org and p.atendimento_id = p_atendimento and p.status = 'rascunho'
           group by k.product_id) x;
  if not exists (select 1 from public.clinic_procedimentos_realizados p
                  where p.organization_id = p_org and p.atendimento_id = p_atendimento and p.status <> 'anulado')
     and v_at.appointment_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('product_id', x.product_id, 'quantidade', x.quantidade)), '[]'::jsonb)
      into v_desejada
      from (select k.product_id, sum(k.quantidade) as quantidade
              from (select s0.procedure_id
                      from public.clinic_plano_sessoes s0
                     where s0.organization_id = p_org and s0.appointment_id = v_at.appointment_id and s0.status <> 'cancelada'
                    union
                    select ap.procedure_id
                      from public.clinic_agendamento_procedimentos ap
                     where ap.organization_id = p_org and ap.appointment_id = v_at.appointment_id) s
              join public.clinic_procedimento_kits k on k.organization_id = p_org and k.procedure_id = s.procedure_id
              join public.clinic_produto_estoque e on e.organization_id = p_org and e.product_id = k.product_id
             group by k.product_id) x;
  end if;

  update public.clinic_estoque_reservas r
     set status = 'liberada', fechada_em = now()
   where r.organization_id = p_org and r.atendimento_id = p_atendimento and r.status = 'ativa'
     and not exists (select 1 from jsonb_to_recordset(v_desejada) d(product_id uuid, quantidade numeric)
                      where d.product_id = r.product_id);
  update public.clinic_estoque_reservas r
     set quantidade = d.quantidade, local_id = v_local
    from jsonb_to_recordset(v_desejada) d(product_id uuid, quantidade numeric)
   where r.organization_id = p_org and r.atendimento_id = p_atendimento and r.status = 'ativa'
     and r.product_id = d.product_id
     and (r.quantidade <> d.quantidade or r.local_id is distinct from v_local);
  insert into public.clinic_estoque_reservas (organization_id, atendimento_id, appointment_id, product_id, local_id, quantidade)
  select p_org, p_atendimento, v_at.appointment_id, d.product_id, v_local, d.quantidade
    from jsonb_to_recordset(v_desejada) d(product_id uuid, quantidade numeric)
   where not exists (select 1 from public.clinic_estoque_reservas r
                      where r.organization_id = p_org and r.atendimento_id = p_atendimento
                        and r.status = 'ativa' and r.product_id = d.product_id);
end $function$;
