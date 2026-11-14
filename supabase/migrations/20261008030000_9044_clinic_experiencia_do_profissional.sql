-- ════════════════════════════════════════════════════════════════════════════
-- 9044 · clinic — experiência do profissional (FORK, agenda S5)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: agenda da clínica, Sprint 5 ("Experiência do Perfil Profissional").
--
-- 1. Chaves novas:
--      pacientes.ver_todos   sem ela, só os pacientes com agendamento com a
--                            própria pessoa (a regra vale nas rotas);
--      prontuario.ver_outros sem ela, só o prontuário dos PRÓPRIOS atendimentos
--                            (a regra vale aqui, na RLS).
--    Concedidas a todo papel que já vê pacientes/prontuário: ninguém perde o
--    que vê hoje. Quem nasce restrito é o papel novo.
-- 2. Papel de sistema "Profissional de saúde" (`profissional`): lista fechada
--    (a mesma de `PAPEL_PROFISSIONAL` em lib/clinic/acesso/catalogo.ts), em toda
--    empresa e no provisionamento de empresa nova.
-- 3. Cadastrar/ativar um profissional (modo por papéis ligado) dá a ele esse
--    papel; se o único papel dele era o modelo "Atendente", ele é trocado.
-- 4. `clinic_agenda_blocks.tipo` (almoço, reunião, pessoal, indisponível, outro).
-- 5. Prontuário: política RESTRITIVA de leitura — o próprio atendimento, ou a
--    empresa onde se tem `prontuario.ver_outros` (calculado uma vez por
--    consulta, não por linha).
-- Idempotente.

-- ─── 1. chaves ──────────────────────────────────────────────────────────────
insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao, clinica) values
  ('pacientes.ver_todos', 'pacientes', 'ver_todos', 'viewer', array['pacientes.ver']::text[], false,
   'Ver todos os pacientes da clínica (sem ela, só os que têm agendamento com a própria pessoa)', false),
  ('prontuario.ver_outros', 'prontuario', 'ver_outros', 'agent', array['prontuario.ver']::text[], false,
   'Ver o prontuário de atendimentos de outros profissionais', true)
on conflict (key) do update
  set modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
      depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao,
      clinica = excluded.clinica;

insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
select rp.organization_id, rp.role_id, x.nova
  from public.clinic_role_permissions rp
  join (values ('pacientes.ver', 'pacientes.ver_todos'), ('prontuario.ver', 'prontuario.ver_outros')) as x(base, nova)
    on rp.permission_key = x.base
  join public.clinic_roles r on r.id = rp.role_id
 where r.system_key is distinct from 'profissional'
on conflict do nothing;

-- ─── 2. o papel "Profissional de saúde" ─────────────────────────────────────
create or replace function public.fn_acesso_provisionar_org(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m record;
  v_id uuid;
begin
  for m in
    select * from (values
      ('administrador', 'Administrador', 'admin', true, 'Acesso total à empresa. Não pode ser excluído nem perder o controle dos papéis.'),
      ('gerente', 'Gerente', 'manager', false, 'Modelo inicial equivalente ao antigo papel Gerente.'),
      ('atendente', 'Atendente', 'agent', false, 'Modelo inicial equivalente ao antigo papel Atendente.'),
      ('visualizador', 'Visualizador', 'viewer', false, 'Modelo inicial equivalente ao antigo papel Visualizador.')
    ) as t(system_key, nome, nivel, sistema, descricao)
  loop
    select id into v_id from public.clinic_roles where organization_id = p_org and system_key = m.system_key;
    if v_id is null then
      insert into public.clinic_roles (organization_id, nome, descricao, is_system, system_key)
      values (
        p_org,
        case when exists (select 1 from public.clinic_roles r where r.organization_id = p_org and lower(btrim(r.nome)) = lower(m.nome))
             then m.nome || ' (modelo)' else m.nome end,
        m.descricao, m.sistema, m.system_key)
      returning id into v_id;
      insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
      select p_org, v_id, c.key from public.clinic_permissions c
       where public.fn_nivel_rank(c.nivel_base) <= public.fn_nivel_rank(m.nivel)
         and not c.clinica
      on conflict do nothing;
    elsif m.sistema then
      insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
      select p_org, v_id, c.key from public.clinic_permissions c
       where not c.clinica
      on conflict do nothing;
    end if;
  end loop;

  -- FORK clinic (9044): o modelo "Profissional de saúde" — lista fechada.
  select id into v_id from public.clinic_roles where organization_id = p_org and system_key = 'profissional';
  if v_id is null then
    insert into public.clinic_roles (organization_id, nome, descricao, is_system, system_key)
    values (
      p_org,
      case when exists (select 1 from public.clinic_roles r where r.organization_id = p_org and lower(btrim(r.nome)) = 'profissional de saúde')
           then 'Profissional de saúde (modelo)' else 'Profissional de saúde' end,
      'Só o trabalho clínico: a própria agenda, os próprios pacientes e prontuários e os documentos do atendimento.',
      false, 'profissional')
    returning id into v_id;
    insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
    select p_org, v_id, c.key from public.clinic_permissions c
     where c.key = any (array[
       'agenda.ver', 'agenda.bloquear_horario',
       'atendimento.ver_fila', 'atendimento.iniciar', 'atendimento.registrar', 'atendimento.finalizar',
       'prontuario.ver', 'prontuario.adendo', 'planos.ver', 'planos.gerenciar',
       'fotos.ver', 'fotos.enviar', 'anexos.ver', 'anexos.enviar',
       'documentos.ver', 'documentos.emitir', 'documentos.colher_aceite',
       'pacientes.ver', 'pacientes.ver_ficha', 'procedimentos.ver', 'pops.ver', 'pops.imprimir'])
    on conflict do nothing;
  end if;
end $$;
revoke execute on function public.fn_acesso_provisionar_org(uuid) from public, anon, authenticated;

do $prov$
declare o record;
begin
  for o in select id from public.organizations loop
    perform public.fn_acesso_provisionar_org(o.id);
  end loop;
end
$prov$;

-- ─── 3. profissional cadastrado ganha o papel ───────────────────────────────
create or replace function public.fn_clinic_profissional_ganha_papel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_papel uuid;
  v_atendente uuid;
begin
  -- O modo lido direto da empresa: `fn_acesso_modo_ligado` só responde a
  -- membros, e o cadastro também chega por service role (importação, seed).
  if not new.is_active or not coalesce((
       select (o.settings -> 'clinic' -> 'acesso_por_permissoes') = 'true'::jsonb
         from public.organizations o where o.id = new.organization_id), false) then
    return new;
  end if;
  if not exists (select 1 from public.user_organizations uo
                  where uo.organization_id = new.organization_id and uo.user_id = new.user_id and uo.revoked_at is null) then
    return new;
  end if;
  select id into v_papel from public.clinic_roles where organization_id = new.organization_id and system_key = 'profissional';
  if v_papel is null then
    return new;
  end if;
  insert into public.clinic_member_roles (organization_id, user_id, role_id)
  values (new.organization_id, new.user_id, v_papel)
  on conflict do nothing;
  -- Se o único outro papel era o modelo "Atendente" (o que o nível legado
  -- deu), ele sai: é o que deixa o menu do profissional só clínico.
  select id into v_atendente from public.clinic_roles where organization_id = new.organization_id and system_key = 'atendente';
  if v_atendente is not null and (
       select array_agg(mr.role_id order by mr.role_id) from public.clinic_member_roles mr
        where mr.organization_id = new.organization_id and mr.user_id = new.user_id
     ) = (select array_agg(x order by x) from unnest(array[v_papel, v_atendente]) x) then
    delete from public.clinic_member_roles
     where organization_id = new.organization_id and user_id = new.user_id and role_id = v_atendente;
  end if;
  return new;
end $$;
revoke execute on function public.fn_clinic_profissional_ganha_papel() from public, anon, authenticated;

drop trigger if exists trg_clinic_profissional_ganha_papel on public.clinic_professionals;
create trigger trg_clinic_profissional_ganha_papel
  after insert or update of is_active on public.clinic_professionals
  for each row execute function public.fn_clinic_profissional_ganha_papel();

-- ─── 4. tipo do bloqueio ─────────────────────────────────────────────────────
alter table public.clinic_agenda_blocks add column if not exists tipo text;
do $tipo$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinic_agenda_blocks_tipo') then
    alter table public.clinic_agenda_blocks add constraint clinic_agenda_blocks_tipo
      check (tipo is null or tipo in ('almoco', 'reuniao', 'pessoal', 'indisponivel', 'outro'));
  end if;
end
$tipo$;

-- ─── 5. prontuário: os próprios atendimentos ────────────────────────────────
-- As empresas do usuário onde ele tem a chave — um conjunto pequeno, avaliado
-- UMA vez por consulta (initplan), em vez de checar permissão linha a linha.
create or replace function public.fn_clinic_orgs_com_permissao(p_chave text)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o from public.fn_user_org_ids() o where public.fn_has_permission(o, p_chave);
$$;
revoke execute on function public.fn_clinic_orgs_com_permissao(text) from public, anon;
grant execute on function public.fn_clinic_orgs_com_permissao(text) to authenticated, service_role;

drop policy if exists acesso_prontuario_proprio on public.clinic_atendimentos;
create policy acesso_prontuario_proprio on public.clinic_atendimentos as restrictive for select
  using (
    professional_user_id = (select auth.uid())
    or organization_id in (select public.fn_clinic_orgs_com_permissao('prontuario.ver_outros'))
  );

do $rls$
declare
  t text;
begin
  foreach t in array array[
    'clinic_atendimento_eventos', 'clinic_formularios_preenchidos', 'clinic_evolucoes', 'clinic_condutas',
    'clinic_procedimentos_realizados', 'clinic_adendos']
  loop
    execute format('drop policy if exists acesso_prontuario_proprio on public.%I', t);
    execute format($p$create policy acesso_prontuario_proprio on public.%I as restrictive for select
      using (
        atendimento_id is null
        or organization_id in (select public.fn_clinic_orgs_com_permissao('prontuario.ver_outros'))
        or atendimento_id in (select a.id from public.clinic_atendimentos a where a.professional_user_id = (select auth.uid()))
      )$p$, t);
  end loop;
  -- Documentos e anexos também são da RECEPÇÃO (termos, aceites, exames
  -- trazidos): quem vê a clínica inteira (`pacientes.ver_todos`) segue vendo.
  -- O papel Profissional de saúde não tem a chave: só os próprios.
  foreach t in array array['clinic_anexos', 'clinic_documentos_emitidos']
  loop
    execute format('drop policy if exists acesso_prontuario_proprio on public.%I', t);
    execute format($p$create policy acesso_prontuario_proprio on public.%I as restrictive for select
      using (
        atendimento_id is null
        or organization_id in (select public.fn_clinic_orgs_com_permissao('prontuario.ver_outros'))
        or organization_id in (select public.fn_clinic_orgs_com_permissao('pacientes.ver_todos'))
        or atendimento_id in (select a.id from public.clinic_atendimentos a where a.professional_user_id = (select auth.uid()))
      )$p$, t);
  end loop;
end
$rls$;

-- ─── 6. registrar no prontuário: só o profissional do atendimento ────────────
-- As funções de registro (9019+) exigem `atendimento.registrar`, mas não
-- conferiam DE QUEM é o atendimento: um colega com a chave gravava evolução no
-- atendimento alheio. Um gatilho só, nas tabelas do registro, vale para todo
-- caminho de escrita. Adendo: o profissional do atendimento ou quem tem
-- `prontuario.ver_outros` (coordenação). Sem sessão (service role) não há a
-- quem conferir: passa.
create or replace function public.fn_clinic_registro_so_do_profissional()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_dono uuid;
begin
  if v_uid is null or new.atendimento_id is null then
    return new;
  end if;
  select a.professional_user_id into v_dono
    from public.clinic_atendimentos a
   where a.id = new.atendimento_id and a.organization_id = new.organization_id;
  if v_dono is null or v_dono = v_uid then
    return new;
  end if;
  if tg_table_name = 'clinic_adendos' and public.fn_has_permission(new.organization_id, 'prontuario.ver_outros') then
    return new;
  end if;
  raise exception 'atendimento_so_o_profissional' using errcode = '42501';
end $$;
revoke execute on function public.fn_clinic_registro_so_do_profissional() from public, anon, authenticated;

do $reg$
declare
  t text;
begin
  foreach t in array array[
    'clinic_evolucoes', 'clinic_condutas', 'clinic_formularios_preenchidos', 'clinic_procedimentos_realizados', 'clinic_adendos']
  loop
    execute format('drop trigger if exists trg_clinic_registro_so_do_profissional on public.%I', t);
    execute format('create trigger trg_clinic_registro_so_do_profissional before insert or update on public.%I
                      for each row execute function public.fn_clinic_registro_so_do_profissional()', t);
  end loop;
end
$reg$;
