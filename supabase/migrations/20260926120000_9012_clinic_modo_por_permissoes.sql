-- ════════════════════════════════════════════════════════════════════════════
-- 9012 · clinic — ligar o modo por permissões e o nível legado CALCULADO (FORK, ACL-011)
-- ════════════════════════════════════════════════════════════════════════════
--
-- `organizations.settings.clinic.acesso_por_permissoes` (nasce desligada).
-- Ligada:
--   * as permissões efetivas vêm dos papéis (fn_member_permissions, 9009);
--   * o papel legado de cada membro (`user_organizations.role`, que alimenta as
--     174 policies e as rotas do upstream) passa a ser CALCULADO: o maior
--     `nivel_base` das permissões efetivas (viewer se nenhuma). Recalculado a
--     cada mudança de papel do membro, de permissão do papel ou de papel
--     ativado/desativado — no mesmo comando (triggers por statement).
--   * a tela de Equipe deixa de trocar o papel legado (a rota recusa).
-- Liga só com pelo menos um membro ativo com o papel Administrador (senão a
-- empresa ficaria sem quem administra). Desligar volta ao papel legado como
-- estava (os papéis customizados ficam guardados para religar).
-- Idempotente.

-- Interna (triggers e funções deste arquivo): lê a opção de qualquer empresa.
create or replace function public.fn_acesso_modo_interno(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select (o.settings -> 'clinic' -> 'acesso_por_permissoes') = 'true'::jsonb
                     from public.organizations o where o.id = p_org), false)
$$;
revoke execute on function public.fn_acesso_modo_interno(uuid) from public, anon, authenticated;

-- Exposta (tela, menu, rota da Equipe): só responde sobre empresa de que quem
-- pergunta é membro (conferência da 0149: fn_user_org_ids); fora dela, false.
create or replace function public.fn_acesso_modo_ligado(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when p_org in (select public.fn_user_org_ids()) or public.fn_is_platform_admin()
             then public.fn_acesso_modo_interno(p_org)
           else false
         end
$$;
revoke execute on function public.fn_acesso_modo_ligado(uuid) from public, anon;
grant  execute on function public.fn_acesso_modo_ligado(uuid) to authenticated, service_role;

-- o nível calculado de todos os membros de uma empresa (só com o modo ligado)
create or replace function public.fn_acesso_recalcular_niveis(p_org uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  if not public.fn_acesso_modo_interno(p_org) then
    return 0;
  end if;
  with calculado as (
    select uo.id,
           case coalesce(max(public.fn_nivel_rank(c.nivel_base)), 1)
             when 4 then 'admin' when 3 then 'manager' when 2 then 'agent' else 'viewer' end as nivel
      from public.user_organizations uo
      left join public.clinic_member_roles mr on mr.organization_id = uo.organization_id and mr.user_id = uo.user_id
      left join public.clinic_roles r on r.organization_id = mr.organization_id and r.id = mr.role_id and r.ativo
      left join public.clinic_role_permissions rp on rp.organization_id = r.organization_id and rp.role_id = r.id
      left join public.clinic_permissions c on c.key = rp.permission_key
     where uo.organization_id = p_org and uo.revoked_at is null
     group by uo.id
  )
  update public.user_organizations uo
     set role = calculado.nivel
    from calculado
   where uo.id = calculado.id and uo.role <> calculado.nivel;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.fn_acesso_recalcular_niveis(uuid) from public, anon, authenticated;

-- triggers por statement: uma recontagem por empresa tocada, não por linha
create or replace function public.fn_acesso_recalcular_apos_membros()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare o uuid;
begin
  if tg_op = 'DELETE' then
    for o in select distinct organization_id from velhas loop perform public.fn_acesso_recalcular_niveis(o); end loop;
  else
    for o in select distinct organization_id from novas loop perform public.fn_acesso_recalcular_niveis(o); end loop;
  end if;
  return null;
end $$;
revoke execute on function public.fn_acesso_recalcular_apos_membros() from public, anon, authenticated;

drop trigger if exists trg_acesso_nivel_membros_ins on public.clinic_member_roles;
create trigger trg_acesso_nivel_membros_ins after insert on public.clinic_member_roles
  referencing new table as novas for each statement execute function public.fn_acesso_recalcular_apos_membros();
drop trigger if exists trg_acesso_nivel_membros_del on public.clinic_member_roles;
create trigger trg_acesso_nivel_membros_del after delete on public.clinic_member_roles
  referencing old table as velhas for each statement execute function public.fn_acesso_recalcular_apos_membros();
drop trigger if exists trg_acesso_nivel_permissoes_ins on public.clinic_role_permissions;
create trigger trg_acesso_nivel_permissoes_ins after insert on public.clinic_role_permissions
  referencing new table as novas for each statement execute function public.fn_acesso_recalcular_apos_membros();
drop trigger if exists trg_acesso_nivel_permissoes_del on public.clinic_role_permissions;
create trigger trg_acesso_nivel_permissoes_del after delete on public.clinic_role_permissions
  referencing old table as velhas for each statement execute function public.fn_acesso_recalcular_apos_membros();

create or replace function public.fn_acesso_recalcular_apos_papel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.ativo is distinct from old.ativo then
    perform public.fn_acesso_recalcular_niveis(new.organization_id);
  end if;
  return null;
end $$;
revoke execute on function public.fn_acesso_recalcular_apos_papel() from public, anon, authenticated;

drop trigger if exists trg_acesso_nivel_papel on public.clinic_roles;
create trigger trg_acesso_nivel_papel after update of ativo on public.clinic_roles
  for each row execute function public.fn_acesso_recalcular_apos_papel();

-- ─── a opção ───────────────────────────────────────────────────────────────
create or replace function public.fn_clinic_definir_acesso_por_permissoes(p_org uuid, p_ligado boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes boolean;
  v_recalculados integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('clinic_acesso:' || p_org::text, 0));
  if p_ligado is null then
    raise exception 'acesso_proibido' using errcode = '42501';
  end if;
  perform public.fn_acesso_exigir(p_org, 'papeis.gerenciar');
  -- quem liga tem de ser Administrador (o modo muda o acesso de todo mundo)
  if not public.fn_acesso_eh_administrador(p_org, auth.uid()) then
    raise exception 'acesso_proibido' using errcode = '42501', detail = 'administrador';
  end if;

  v_antes := public.fn_acesso_modo_interno(p_org);
  if p_ligado then
    perform public.fn_acesso_provisionar_org(p_org);
    perform public.fn_acesso_exigir_um_administrador(p_org);
  end if;

  update public.organizations
     set settings = jsonb_set(
           coalesce(settings, '{}'::jsonb),
           '{clinic}',
           (case when jsonb_typeof(settings -> 'clinic') = 'object' then settings -> 'clinic' else '{}'::jsonb end)
             || jsonb_build_object('acesso_por_permissoes', p_ligado),
           true)
   where id = p_org;

  if p_ligado then
    v_recalculados := public.fn_acesso_recalcular_niveis(p_org);
  end if;
  return jsonb_build_object('ligado', p_ligado, 'mudou', v_antes <> p_ligado, 'niveis_recalculados', v_recalculados);
end $$;
revoke execute on function public.fn_clinic_definir_acesso_por_permissoes(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_acesso_por_permissoes(uuid, boolean) to authenticated;

-- ─── com o modo ligado, o papel legado NUNCA é escrito à mão ───────────────
-- Qualquer caminho que atualize `user_organizations.role` (a rota da Equipe do
-- upstream, um script, o suporte) recebe o nível calculado das permissões.
create or replace function public.fn_acesso_nivel_do_membro(p_org uuid, p_user uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case coalesce(max(public.fn_nivel_rank(c.nivel_base)), 1)
           when 4 then 'admin' when 3 then 'manager' when 2 then 'agent' else 'viewer' end
    from public.clinic_member_roles mr
    join public.clinic_roles r on r.organization_id = mr.organization_id and r.id = mr.role_id and r.ativo
    join public.clinic_role_permissions rp on rp.organization_id = r.organization_id and rp.role_id = r.id
    join public.clinic_permissions c on c.key = rp.permission_key
   where mr.organization_id = p_org and mr.user_id = p_user
$$;
revoke execute on function public.fn_acesso_nivel_do_membro(uuid, uuid) from public, anon, authenticated;

create or replace function public.fn_acesso_nivel_calculado_no_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.fn_acesso_modo_interno(new.organization_id) then
    new.role := public.fn_acesso_nivel_do_membro(new.organization_id, new.user_id);
  end if;
  return new;
end $$;
revoke execute on function public.fn_acesso_nivel_calculado_no_update() from public, anon, authenticated;

drop trigger if exists trg_acesso_nivel_calculado on public.user_organizations;
create trigger trg_acesso_nivel_calculado
  before update of role on public.user_organizations
  for each row execute function public.fn_acesso_nivel_calculado_no_update();

-- Convite aceito com o modo ligado: o membro novo recebe o papel-modelo do
-- nível do convite (sem isso nasceria sem papel nenhum). Com o modo desligado,
-- segue o espelho da 9011. (forward-fix da função da 9011)
create or replace function public.fn_acesso_espelhar_papel_legado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_modelo uuid;
begin
  perform public.fn_acesso_provisionar_org(new.organization_id);
  v_modelo := public.fn_acesso_papel_modelo(new.organization_id, new.role);
  if public.fn_acesso_modo_interno(new.organization_id) then
    if tg_op = 'INSERT' and v_modelo is not null then
      insert into public.clinic_member_roles (organization_id, user_id, role_id)
      values (new.organization_id, new.user_id, v_modelo)
      on conflict do nothing;
    end if;
    return null;
  end if;
  delete from public.clinic_member_roles where organization_id = new.organization_id and user_id = new.user_id;
  if v_modelo is not null then
    insert into public.clinic_member_roles (organization_id, user_id, role_id)
    values (new.organization_id, new.user_id, v_modelo)
    on conflict do nothing;
  end if;
  return null;
end $$;
revoke execute on function public.fn_acesso_espelhar_papel_legado() from public, anon, authenticated;
