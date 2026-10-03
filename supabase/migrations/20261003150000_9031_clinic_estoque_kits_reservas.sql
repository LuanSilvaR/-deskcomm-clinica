-- ════════════════════════════════════════════════════════════════════════════
-- 9031 · clinic — estoque: kit por procedimento e reservas (FORK, estoque E3)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/estoque/plano.md.
--
--   clinic_procedimento_kits   o que um procedimento costuma gastar (produto e
--                              quantidade na unidade de aplicação). Não muda
--                              clinic_procedures.
--   clinic_estoque_reservas    o que já está prometido a um atendimento (ou a um
--                              agendamento de amanhã). NÃO é movimento: o saldo
--                              não muda; o DISPONÍVEL = saldo − reservas ativas.
--
-- Ciclo da reserva:
--   • véspera (cron estoque-reservas): agendamento ligado a uma sessão de plano
--     cujo procedimento tem kit → reserva pelo agendamento;
--   • iniciar o atendimento: as reservas do agendamento passam para o
--     atendimento (`convertida`) e o atendimento reserva o kit da sessão;
--   • registrar/alterar procedimentos (rascunho): a reserva passa a ser a soma
--     dos kits dos procedimentos registrados;
--   • finalizar: `convertida` (a baixa é a E2); anular: `liberada`; reabrir não
--     reserva de novo o que já saiu — só os procedimentos novos reservam;
--   • agendamento que passou sem atendimento ou foi cancelado: `expirada`.
--
-- Tudo com a opção `settings.clinic.estoque` ligada e só para produtos
-- configurados no estoque. Reserva nunca trava o atendimento.
-- Aditiva e idempotente (também anexada ao fim de supabase/baseline.sql).

create table if not exists public.clinic_procedimento_kits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedure_id uuid not null,
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  quantidade numeric(14,3) not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint clinic_procedimento_kits_unico unique (organization_id, procedure_id, product_id),
  constraint clinic_procedimento_kits_quantidade check (quantidade > 0 and quantidade <= 10000000),
  constraint clinic_procedimento_kits_procedimento_fk foreign key (organization_id, procedure_id)
    references public.clinic_procedures (organization_id, id) on delete cascade
);

create table if not exists public.clinic_estoque_reservas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  atendimento_id uuid,
  appointment_id uuid references public.calendar_appointments(id) on delete cascade,
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  local_id uuid,
  quantidade numeric(14,3) not null,
  status text not null default 'ativa',
  created_at timestamptz not null default now(),
  fechada_em timestamptz,
  constraint clinic_estoque_reservas_org_id_key unique (organization_id, id),
  constraint clinic_estoque_reservas_status check (status in ('ativa', 'convertida', 'liberada', 'expirada')),
  constraint clinic_estoque_reservas_quantidade check (quantidade > 0),
  constraint clinic_estoque_reservas_alvo check (atendimento_id is not null or appointment_id is not null),
  constraint clinic_estoque_reservas_atendimento_fk foreign key (organization_id, atendimento_id)
    references public.clinic_atendimentos (organization_id, id) on delete cascade,
  constraint clinic_estoque_reservas_local_fk foreign key (organization_id, local_id)
    references public.clinic_estoque_locais (organization_id, id)
);
create unique index if not exists clinic_estoque_reservas_atendimento_ativa
  on public.clinic_estoque_reservas (organization_id, atendimento_id, product_id)
  where status = 'ativa' and atendimento_id is not null;
create unique index if not exists clinic_estoque_reservas_agendamento_ativa
  on public.clinic_estoque_reservas (organization_id, appointment_id, product_id)
  where status = 'ativa' and atendimento_id is null;
create index if not exists clinic_estoque_reservas_ativas_idx
  on public.clinic_estoque_reservas (organization_id, product_id) where status = 'ativa';

do $rls$
begin
  alter table public.clinic_procedimento_kits enable row level security;
  drop policy if exists tenant_isolation_clinic_procedimento_kits_all on public.clinic_procedimento_kits;
  create policy tenant_isolation_clinic_procedimento_kits_all on public.clinic_procedimento_kits
    using ((organization_id in (select public.fn_user_org_ids()))
           and public.fn_role_at_least(organization_id, 'viewer'))
    with check ((organization_id in (select public.fn_user_org_ids()))
           and public.fn_role_at_least(organization_id, 'viewer'));
  -- o kit é configuração: lê quem vê procedimentos ou registra atendimento
  drop policy if exists acesso_ler on public.clinic_procedimento_kits;
  create policy acesso_ler on public.clinic_procedimento_kits as restrictive for select
    using (public.fn_has_permission(organization_id, 'procedimentos.ver')
           or public.fn_has_permission(organization_id, 'atendimento.registrar'));
  revoke all on public.clinic_procedimento_kits from anon;
  revoke insert, update, delete, truncate on public.clinic_procedimento_kits from authenticated;

  alter table public.clinic_estoque_reservas enable row level security;
  drop policy if exists tenant_isolation_clinic_estoque_reservas_all on public.clinic_estoque_reservas;
  create policy tenant_isolation_clinic_estoque_reservas_all on public.clinic_estoque_reservas
    using ((organization_id in (select public.fn_user_org_ids()))
           and public.fn_role_at_least(organization_id, 'viewer'))
    with check ((organization_id in (select public.fn_user_org_ids()))
           and public.fn_role_at_least(organization_id, 'viewer'));
  drop policy if exists acesso_ler on public.clinic_estoque_reservas;
  create policy acesso_ler on public.clinic_estoque_reservas as restrictive for select
    using (public.fn_has_permission(organization_id, 'estoque.ver'));
  revoke all on public.clinic_estoque_reservas from anon;
  revoke insert, update, delete, truncate on public.clinic_estoque_reservas from authenticated;
end
$rls$;

-- ─── o kit de um procedimento (substitui a lista inteira) ──────────────────
create or replace function public.fn_clinic_estoque_kit_salvar(p_org uuid, p_procedure uuid, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  perform public.fn_acesso_exigir(p_org, 'procedimentos.gerenciar');
  if not exists (select 1 from public.clinic_procedures p where p.id = p_procedure and p.organization_id = p_org) then
    raise exception 'estoque_procedimento_invalido' using errcode = 'P0002';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 50 then
    raise exception 'estoque_dados_invalidos' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_itens) x
     where nullif(x ->> 'product_id', '') is null
        or coalesce((x ->> 'quantidade')::numeric, 0) <= 0
        or not exists (select 1 from public.catalog_products c
                        where c.id = (x ->> 'product_id')::uuid and c.organization_id = p_org)) then
    raise exception 'estoque_produto_invalido' using errcode = '22023';
  end if;
  if (select count(distinct x ->> 'product_id') from jsonb_array_elements(p_itens) x) <> jsonb_array_length(p_itens) then
    raise exception 'estoque_dados_invalidos' using errcode = '22023';
  end if;

  delete from public.clinic_procedimento_kits k where k.organization_id = p_org and k.procedure_id = p_procedure;
  insert into public.clinic_procedimento_kits (organization_id, procedure_id, product_id, quantidade, created_by)
  select p_org, p_procedure, (x ->> 'product_id')::uuid, round((x ->> 'quantidade')::numeric, 3), auth.uid()
    from jsonb_array_elements(p_itens) x;
  get diagnostics v_n = row_count;
  return jsonb_build_object('itens', v_n);
end $$;
revoke execute on function public.fn_clinic_estoque_kit_salvar(uuid, uuid, jsonb) from public, anon;
grant  execute on function public.fn_clinic_estoque_kit_salvar(uuid, uuid, jsonb) to authenticated;

-- ─── reservas de um atendimento = soma dos kits (interna) ──────────────────
-- Procedimentos em rascunho do atendimento; sem nenhum registrado, o kit do
-- procedimento da sessão do plano ligada ao agendamento.
create or replace function public.fn_clinic_estoque_reservar_atendimento(p_org uuid, p_atendimento uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
              from public.clinic_plano_sessoes s
              join public.clinic_procedimento_kits k on k.organization_id = p_org and k.procedure_id = s.procedure_id
              join public.clinic_produto_estoque e on e.organization_id = p_org and e.product_id = k.product_id
             where s.organization_id = p_org and s.appointment_id = v_at.appointment_id and s.status <> 'cancelada'
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
end $$;
revoke execute on function public.fn_clinic_estoque_reservar_atendimento(uuid, uuid) from public, anon, authenticated;

-- ─── gatilhos do ciclo ──────────────────────────────────────────────────────
create or replace function public.fn_clinic_estoque_reservas_do_atendimento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.fn_clinic_estoque_reservar_atendimento(new.organization_id, new.id);
  elsif new.status is distinct from old.status then
    if new.status in ('finalizado', 'anulado') then
      update public.clinic_estoque_reservas r
         set status = case when new.status = 'finalizado' then 'convertida' else 'liberada' end, fechada_em = now()
       where r.organization_id = new.organization_id and r.atendimento_id = new.id and r.status = 'ativa';
    end if;
  end if;
  return null;
end $$;
revoke execute on function public.fn_clinic_estoque_reservas_do_atendimento() from public, anon, authenticated;
drop trigger if exists trg_clinic_estoque_reservas_do_atendimento on public.clinic_atendimentos;
create trigger trg_clinic_estoque_reservas_do_atendimento
  after insert or update of status on public.clinic_atendimentos
  for each row execute function public.fn_clinic_estoque_reservas_do_atendimento();

create or replace function public.fn_clinic_estoque_reservas_do_procedimento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- finalizar (fn_clinic_congelar_registros) não recalcula: a reserva vira
  -- `convertida` quando o atendimento fecha.
  if tg_op = 'UPDATE' and new.status = 'finalizado' then
    return null;
  end if;
  perform public.fn_clinic_estoque_reservar_atendimento(new.organization_id, new.atendimento_id);
  return null;
end $$;
revoke execute on function public.fn_clinic_estoque_reservas_do_procedimento() from public, anon, authenticated;
drop trigger if exists trg_clinic_estoque_reservas_do_procedimento on public.clinic_procedimentos_realizados;
create trigger trg_clinic_estoque_reservas_do_procedimento
  after insert or update of procedure_id, status on public.clinic_procedimentos_realizados
  for each row execute function public.fn_clinic_estoque_reservas_do_procedimento();

-- ─── véspera: reservar pelos agendamentos (cron estoque-reservas) ──────────
-- Agendamentos das próximas 36 h ligados a sessão de plano com kit, ainda sem
-- atendimento. Reservas de agendamento que passou (12 h) ou foi cancelado
-- expiram. Só service role.
create or replace function public.fn_clinic_estoque_reservar_agenda()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    from public.clinic_plano_sessoes s
    join public.calendar_appointments ap on ap.id = s.appointment_id and ap.organization_id = s.organization_id
    join public.organizations o on o.id = s.organization_id and (o.settings -> 'clinic' -> 'estoque') = 'true'::jsonb
    join public.clinic_procedimento_kits k on k.organization_id = s.organization_id and k.procedure_id = s.procedure_id
    join public.clinic_produto_estoque e on e.organization_id = s.organization_id and e.product_id = k.product_id
   where s.status = 'agendada'
     and ap.status in ('pending', 'confirmed')
     and ap.starts_at between now() and now() + interval '36 hours'
     and not exists (select 1 from public.clinic_atendimentos a where a.appointment_id = ap.id)
   group by s.organization_id, s.appointment_id, k.product_id
  on conflict (organization_id, appointment_id, product_id) where status = 'ativa' and atendimento_id is null
  do update set quantidade = excluded.quantidade;
  get diagnostics v_criadas = row_count;
  return jsonb_build_object('reservadas', v_criadas, 'expiradas', v_expiradas);
end $$;
revoke execute on function public.fn_clinic_estoque_reservar_agenda() from public, anon, authenticated;
grant  execute on function public.fn_clinic_estoque_reservar_agenda() to service_role;

-- ─── disponível por produto (para a tela do atendimento) ────────────────────
-- Saldo de lotes não vencidos − reservas ativas, e o lote que sai primeiro
-- (FEFO). Para quem registra atendimento (não precisa de estoque.ver) ou vê o
-- estoque. Sem dado de paciente. Opção desligada → nulo.
create or replace function public.fn_clinic_estoque_disponibilidade(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or p_org is null
     or not (p_org in (select public.fn_user_org_ids()))
     or not (public.fn_has_permission(p_org, 'atendimento.registrar') or public.fn_has_permission(p_org, 'estoque.ver')) then
    raise exception 'acesso_proibido' using errcode = '42501';
  end if;
  if not coalesce((select (o.settings -> 'clinic' -> 'estoque') = 'true'::jsonb
                     from public.organizations o where o.id = p_org), false) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', e.product_id,
             'unidade', e.unidade_aplicacao,
             'disponivel', round(coalesce(s.saldo, 0) - coalesce(r.reservado, 0), 3),
             'lote', f.codigo,
             'validade', f.validade))
      from public.clinic_produto_estoque e
      left join lateral (
        select sum(m.quantidade) as saldo
          from public.clinic_estoque_movimentos m
          join public.clinic_estoque_lotes l on l.id = m.lote_id
         where m.organization_id = p_org and m.product_id = e.product_id
           and (l.validade is null or l.validade >= current_date)) s on true
      left join lateral (
        select sum(x.quantidade) as reservado
          from public.clinic_estoque_reservas x
         where x.organization_id = p_org and x.product_id = e.product_id and x.status = 'ativa') r on true
      left join lateral (
        select l.codigo, l.validade
          from public.clinic_estoque_lotes l
         where l.organization_id = p_org and l.product_id = e.product_id
           and (l.validade is null or l.validade >= current_date)
           and (select coalesce(sum(m.quantidade), 0) from public.clinic_estoque_movimentos m
                 where m.organization_id = p_org and m.lote_id = l.id) > 0
         order by l.validade nulls last, l.created_at, l.id
         limit 1) f on true
     where e.organization_id = p_org), '[]'::jsonb);
end $$;
revoke execute on function public.fn_clinic_estoque_disponibilidade(uuid) from public, anon;
grant  execute on function public.fn_clinic_estoque_disponibilidade(uuid) to authenticated;
