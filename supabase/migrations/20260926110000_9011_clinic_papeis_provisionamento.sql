-- ════════════════════════════════════════════════════════════════════════════
-- 9011 · clinic — papéis-modelo em toda empresa e migração dos membros (FORK, ACL-005)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Toda empresa ganha 4 papéis, com as permissões que o nível legado já dava
-- (a MESMA regra de `permissoesDoNivel` em lib/clinic/acesso/catalogo.ts):
--   Administrador (is_system — intocável; todas as permissões)
--   Gerente (≤ manager) · Atendente (≤ agent) · Visualizador (≤ viewer)
-- Os três últimos são modelos editáveis.
--
-- Cada membro recebe o papel do seu nível atual: admin→Administrador,
-- manager→Gerente, agent→Atendente, viewer→Visualizador. Assim o nível
-- derivado das permissões == nível atual para TODOS (invariante prova).
--
-- Enquanto a empresa NÃO liga `acesso_por_permissoes`, o papel legado manda:
-- trocar o papel na Equipe (ou convidar) espelha o papel-modelo aqui, para que
-- ligar o modo depois comece exatamente de onde a empresa está.
-- Idempotente (reaplicar não duplica nem sobrescreve edição).

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
        -- nome já usado por um papel criado à mão: não colide
        case when exists (select 1 from public.clinic_roles r where r.organization_id = p_org and lower(btrim(r.nome)) = lower(m.nome))
             then m.nome || ' (modelo)' else m.nome end,
        m.descricao, m.sistema, m.system_key)
      returning id into v_id;
      insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
      select p_org, v_id, c.key from public.clinic_permissions c
       where public.fn_nivel_rank(c.nivel_base) <= public.fn_nivel_rank(m.nivel)
      on conflict do nothing;
    elsif m.sistema then
      -- o Administrador sempre tem o catálogo inteiro (permissão nova entra sozinha)
      insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
      select p_org, v_id, c.key from public.clinic_permissions c
      on conflict do nothing;
    end if;
  end loop;
end $$;
revoke execute on function public.fn_acesso_provisionar_org(uuid) from public, anon, authenticated;

create or replace function public.fn_acesso_papel_modelo(p_org uuid, p_nivel text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.clinic_roles
   where organization_id = p_org
     and system_key = case p_nivel when 'admin' then 'administrador' when 'manager' then 'gerente'
                                   when 'agent' then 'atendente' else 'visualizador' end
$$;
revoke execute on function public.fn_acesso_papel_modelo(uuid, text) from public, anon, authenticated;

-- empresa nova nasce com os papéis
create or replace function public.fn_acesso_provisionar_org_nova()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_acesso_provisionar_org(new.id);
  return null;
end $$;
revoke execute on function public.fn_acesso_provisionar_org_nova() from public, anon, authenticated;

drop trigger if exists trg_acesso_provisionar_org on public.organizations;
create trigger trg_acesso_provisionar_org
  after insert on public.organizations
  for each row execute function public.fn_acesso_provisionar_org_nova();

-- com o modo desligado, o papel legado é espelhado no papel-modelo
create or replace function public.fn_acesso_espelhar_papel_legado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ligado boolean;
  v_modelo uuid;
begin
  select (o.settings -> 'clinic' -> 'acesso_por_permissoes') = 'true'::jsonb into v_ligado
    from public.organizations o where o.id = new.organization_id;
  if coalesce(v_ligado, false) then
    return null;
  end if;
  perform public.fn_acesso_provisionar_org(new.organization_id);
  v_modelo := public.fn_acesso_papel_modelo(new.organization_id, new.role);
  delete from public.clinic_member_roles where organization_id = new.organization_id and user_id = new.user_id;
  if v_modelo is not null then
    insert into public.clinic_member_roles (organization_id, user_id, role_id)
    values (new.organization_id, new.user_id, v_modelo)
    on conflict do nothing;
  end if;
  return null;
end $$;
revoke execute on function public.fn_acesso_espelhar_papel_legado() from public, anon, authenticated;

drop trigger if exists trg_acesso_espelhar_papel_legado on public.user_organizations;
create trigger trg_acesso_espelhar_papel_legado
  after insert or update of role on public.user_organizations
  for each row execute function public.fn_acesso_espelhar_papel_legado();

-- ─── backfill: toda empresa e todo membro de hoje ──────────────────────────
do $$
declare o record;
begin
  for o in select id from public.organizations loop
    perform public.fn_acesso_provisionar_org(o.id);
  end loop;
end $$;

insert into public.clinic_member_roles (organization_id, user_id, role_id)
select uo.organization_id, uo.user_id, public.fn_acesso_papel_modelo(uo.organization_id, uo.role)
  from public.user_organizations uo
 where not exists (
         select 1 from public.clinic_member_roles mr
          where mr.organization_id = uo.organization_id and mr.user_id = uo.user_id)
   and public.fn_acesso_papel_modelo(uo.organization_id, uo.role) is not null
on conflict do nothing;
