-- ════════════════════════════════════════════════════════════════════════════
-- 9010 · clinic — escrita de papéis de acesso, com as travas no banco (FORK, ACL-003)
-- ════════════════════════════════════════════════════════════════════════════
--
-- As rotas NUNCA escrevem nas tabelas da 9009 (não há policy de escrita): tudo
-- passa por estas funções, que aplicam no MESMO lugar, sob lock por empresa:
--
--   * quem pede: sessão, suporte com escrita, MFA provado quando há fator, e a
--     permissão certa (`papeis.gerenciar` / `equipe.atribuir_papeis`);
--   * REGRA DE CONCESSÃO: só se dá (a papel ou a pessoa) permissão que o próprio
--     ator TEM — exceto quem tem o papel de sistema Administrador;
--   * DEPENDÊNCIAS completas (editar exige ver): papel incoerente é recusado;
--   * ANTITRAVAMENTO: o papel de sistema Administrador não se exclui, não se
--     desativa, não se renomeia e não perde as permissões críticas; e a empresa
--     nunca fica sem nenhum membro ativo com o papel Administrador;
--   * isolamento: todo id é conferido contra a empresa (senão "não encontrado").
--
-- `pg_advisory_xact_lock` por empresa fecha a corrida de duas pessoas tirando
-- o "último administrador" ao mesmo tempo. Idempotente.

create or replace function public.fn_acesso_eh_administrador(p_org uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.clinic_member_roles mr
      join public.clinic_roles r on r.organization_id = mr.organization_id and r.id = mr.role_id
      join public.user_organizations uo on uo.organization_id = mr.organization_id and uo.user_id = mr.user_id
     where mr.organization_id = p_org and mr.user_id = p_user
       and r.system_key = 'administrador' and r.ativo
       and uo.revoked_at is null)
$$;
revoke execute on function public.fn_acesso_eh_administrador(uuid, uuid) from public, anon, authenticated;

-- A pessoa que pede pode mexer nisto? (sessão, suporte, MFA, permissão)
create or replace function public.fn_acesso_exigir(p_org uuid, p_permissao text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or p_org is null or not public.fn_support_write_allowed(p_org) then
    raise exception 'acesso_proibido' using errcode = '42501';
  end if;
  if not public.fn_session_mfa_proven() then
    raise exception 'acesso_mfa_exigido' using errcode = '42501';
  end if;
  if not public.fn_has_permission(p_org, p_permissao) then
    raise exception 'acesso_proibido' using errcode = '42501', detail = p_permissao;
  end if;
end $$;
revoke execute on function public.fn_acesso_exigir(uuid, text) from public, anon, authenticated;

-- Regra de concessão: as chaves pedidas cabem no que o ator tem?
create or replace function public.fn_acesso_exigir_concessao(p_org uuid, p_chaves text[])
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_faltam text[];
begin
  if public.fn_acesso_eh_administrador(p_org, auth.uid()) then
    return;
  end if;
  select array_agg(k order by k) into v_faltam
    from unnest(coalesce(p_chaves, '{}')) k
   where not exists (select 1 from public.fn_member_permissions(p_org) m where m = k);
  if v_faltam is not null then
    raise exception 'acesso_concessao_acima_do_proprio'
      using errcode = '42501', detail = array_to_string(v_faltam, ',');
  end if;
end $$;
revoke execute on function public.fn_acesso_exigir_concessao(uuid, text[]) from public, anon, authenticated;

-- A empresa ainda tem alguém com o papel Administrador?
create or replace function public.fn_acesso_exigir_um_administrador(p_org uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
      from public.clinic_member_roles mr
      join public.clinic_roles r on r.organization_id = mr.organization_id and r.id = mr.role_id
      join public.user_organizations uo on uo.organization_id = mr.organization_id and uo.user_id = mr.user_id
     where mr.organization_id = p_org and r.system_key = 'administrador' and r.ativo and uo.revoked_at is null
  ) then
    raise exception 'acesso_ultimo_administrador' using errcode = '23514';
  end if;
end $$;
revoke execute on function public.fn_acesso_exigir_um_administrador(uuid) from public, anon, authenticated;

-- ─── salvar papel (criar/editar) com a lista de permissões ─────────────────
create or replace function public.fn_acesso_salvar_papel(
  p_org uuid,
  p_id uuid,
  p_nome text,
  p_descricao text,
  p_ativo boolean,
  p_permissoes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_papel public.clinic_roles%rowtype;
  v_novas text[] := coalesce((select array_agg(distinct k) from unnest(coalesce(p_permissoes, '{}')) k), '{}');
  v_antigas text[] := '{}';
  v_adicionadas text[];
  v_removidas text[];
  v_invalidas text[];
  v_faltando text[];
begin
  perform pg_advisory_xact_lock(hashtextextended('clinic_acesso:' || p_org::text, 0));
  perform public.fn_acesso_exigir(p_org, 'papeis.gerenciar');

  select array_agg(k) into v_invalidas from unnest(v_novas) k
   where not exists (select 1 from public.clinic_permissions c where c.key = k);
  if v_invalidas is not null then
    raise exception 'acesso_permissao_desconhecida' using errcode = '22023', detail = array_to_string(v_invalidas, ',');
  end if;
  select array_agg(distinct d order by d) into v_faltando
    from public.clinic_permissions c, unnest(c.depende_de) d
   where c.key = any(v_novas) and not d = any(v_novas);
  if v_faltando is not null then
    raise exception 'acesso_dependencia_faltando' using errcode = '22023', detail = array_to_string(v_faltando, ',');
  end if;

  if p_id is null then
    insert into public.clinic_roles (organization_id, nome, descricao, ativo)
    values (p_org, btrim(p_nome), nullif(btrim(coalesce(p_descricao, '')), ''), coalesce(p_ativo, true))
    returning * into v_papel;
  else
    select * into v_papel from public.clinic_roles where organization_id = p_org and id = p_id for update;
    if not found then
      raise exception 'acesso_papel_nao_encontrado' using errcode = 'P0002';
    end if;
    select coalesce(array_agg(permission_key), '{}') into v_antigas
      from public.clinic_role_permissions where organization_id = p_org and role_id = p_id;
    if v_papel.is_system then
      if btrim(p_nome) <> v_papel.nome or coalesce(p_ativo, true) is distinct from true then
        raise exception 'acesso_papel_de_sistema' using errcode = '42501';
      end if;
      select array_agg(c.key order by c.key) into v_faltando from public.clinic_permissions c
       where c.critica and not c.key = any(v_novas);
      if v_faltando is not null then
        raise exception 'acesso_papel_de_sistema' using errcode = '42501', detail = array_to_string(v_faltando, ',');
      end if;
    end if;
    update public.clinic_roles
       set nome = btrim(p_nome), descricao = nullif(btrim(coalesce(p_descricao, '')), ''), ativo = coalesce(p_ativo, true)
     where id = p_id;
  end if;

  select coalesce(array_agg(k order by k), '{}') into v_adicionadas from unnest(v_novas) k where not k = any(v_antigas);
  select coalesce(array_agg(k order by k), '{}') into v_removidas from unnest(v_antigas) k where not k = any(v_novas);
  perform public.fn_acesso_exigir_concessao(p_org, v_adicionadas);

  delete from public.clinic_role_permissions where organization_id = p_org and role_id = v_papel.id;
  insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
  select p_org, v_papel.id, k from unnest(v_novas) k;

  -- desativar um papel pode tirar o último Administrador? (papel de sistema já barrado acima)
  perform public.fn_acesso_exigir_um_administrador(p_org);

  return jsonb_build_object('id', v_papel.id, 'criado', p_id is null, 'adicionadas', to_jsonb(v_adicionadas), 'removidas', to_jsonb(v_removidas));
end $$;
revoke execute on function public.fn_acesso_salvar_papel(uuid, uuid, text, text, boolean, text[]) from public, anon;
grant  execute on function public.fn_acesso_salvar_papel(uuid, uuid, text, text, boolean, text[]) to authenticated;

-- ─── excluir papel (só custom e sem ninguém nele) ──────────────────────────
create or replace function public.fn_acesso_excluir_papel(p_org uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_papel public.clinic_roles%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('clinic_acesso:' || p_org::text, 0));
  perform public.fn_acesso_exigir(p_org, 'papeis.gerenciar');
  select * into v_papel from public.clinic_roles where organization_id = p_org and id = p_id for update;
  if not found then
    raise exception 'acesso_papel_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_papel.is_system then
    raise exception 'acesso_papel_de_sistema' using errcode = '42501';
  end if;
  if exists (select 1 from public.clinic_member_roles where organization_id = p_org and role_id = p_id) then
    raise exception 'acesso_papel_em_uso' using errcode = '23503';
  end if;
  delete from public.clinic_roles where id = p_id;
  return jsonb_build_object('id', p_id, 'nome', v_papel.nome);
end $$;
revoke execute on function public.fn_acesso_excluir_papel(uuid, uuid) from public, anon;
grant  execute on function public.fn_acesso_excluir_papel(uuid, uuid) to authenticated;

-- ─── os papéis de um membro (substitui a lista) ────────────────────────────
create or replace function public.fn_acesso_atribuir_papeis(p_org uuid, p_user uuid, p_papeis uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_novos uuid[] := coalesce((select array_agg(distinct x) from unnest(coalesce(p_papeis, '{}')) x), '{}');
  v_antigos uuid[];
  v_adicionados uuid[];
  v_removidos uuid[];
  v_invalidos int;
  v_chaves text[];
begin
  perform pg_advisory_xact_lock(hashtextextended('clinic_acesso:' || p_org::text, 0));
  perform public.fn_acesso_exigir(p_org, 'equipe.atribuir_papeis');

  if not exists (select 1 from public.user_organizations where organization_id = p_org and user_id = p_user and revoked_at is null) then
    raise exception 'acesso_membro_nao_encontrado' using errcode = 'P0002';
  end if;
  select count(*) into v_invalidos from unnest(v_novos) x
   where not exists (select 1 from public.clinic_roles r where r.organization_id = p_org and r.id = x and r.ativo);
  if v_invalidos > 0 then
    raise exception 'acesso_papel_nao_encontrado' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(role_id), '{}') into v_antigos
    from public.clinic_member_roles where organization_id = p_org and user_id = p_user;
  select coalesce(array_agg(x), '{}') into v_adicionados from unnest(v_novos) x where not x = any(v_antigos);
  select coalesce(array_agg(x), '{}') into v_removidos from unnest(v_antigos) x where not x = any(v_novos);

  -- regra de concessão: tudo o que os papéis ADICIONADOS dão, o ator precisa ter
  select coalesce(array_agg(distinct rp.permission_key), '{}') into v_chaves
    from public.clinic_role_permissions rp
   where rp.organization_id = p_org and rp.role_id = any(v_adicionados);
  perform public.fn_acesso_exigir_concessao(p_org, v_chaves);

  delete from public.clinic_member_roles where organization_id = p_org and user_id = p_user;
  insert into public.clinic_member_roles (organization_id, user_id, role_id, granted_by)
  select p_org, p_user, x, auth.uid() from unnest(v_novos) x;

  perform public.fn_acesso_exigir_um_administrador(p_org);

  return jsonb_build_object('user_id', p_user, 'adicionados', to_jsonb(v_adicionados), 'removidos', to_jsonb(v_removidos));
end $$;
revoke execute on function public.fn_acesso_atribuir_papeis(uuid, uuid, uuid[]) from public, anon;
grant  execute on function public.fn_acesso_atribuir_papeis(uuid, uuid, uuid[]) to authenticated;
