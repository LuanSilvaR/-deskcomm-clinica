-- ════════════════════════════════════════════════════════════════════════════
-- 9016 · clinic — acesso CLÍNICO separado da administração (FORK, prontuário F0)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: docs/tarefas/prontuario/plano.md (seções 10 e 11).
--
-- Chaves de conteúdo clínico (prontuário, evolução, fotos, anexos, planos)
-- ganham a marca `clinica`. Elas NUNCA vêm de brinde:
--
--   * suporte (impersonação) não recebe nenhuma, nem no modo "full";
--   * modo legado (como a empresa nasce): além do nível, a pessoa precisa ser
--     PROFISSIONAL ativo (`clinic_professionals.is_active`) na empresa;
--   * modo por papéis: só por papel atribuído — e o papel de sistema
--     Administrador não as concede (o admin que atende atribui a si um papel
--     clínico, e a atribuição fica no registro de auditoria);
--   * papéis-modelo não as recebem no provisionamento.
--
-- As chaves não-clínicas novas (fila de atendimento, documentos, modelos)
-- seguem a regra de sempre (nível legado). Também cria a opção
-- `settings.clinic.prontuario` (nasce desligada). Nada aqui cria tabela clínica
-- nem muda o acesso de chave que já existia. Idempotente.

-- ─── marca clínica no catálogo ─────────────────────────────────────────────
alter table public.clinic_permissions add column if not exists clinica boolean not null default false;

insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao, clinica) values
  ('atendimento.ver_fila', 'atendimento', 'ver_fila', 'agent', array[]::text[], false, 'Ver a fila de atendimentos e o status de cada paciente (sem conteúdo clínico)', false),
  ('atendimento.iniciar', 'atendimento', 'iniciar', 'agent', array['atendimento.ver_fila','prontuario.ver']::text[], false, 'Iniciar o atendimento do paciente', true),
  ('atendimento.registrar', 'atendimento', 'registrar', 'agent', array['prontuario.ver']::text[], false, 'Registrar anamnese, avaliação, conduta, procedimentos e evolução', true),
  ('atendimento.finalizar', 'atendimento', 'finalizar', 'agent', array['atendimento.registrar']::text[], false, 'Finalizar o atendimento (os registros ficam imutáveis)', true),
  ('atendimento.reabrir', 'atendimento', 'reabrir', 'manager', array['atendimento.finalizar']::text[], false, 'Reabrir atendimento finalizado, com motivo', true),
  ('prontuario.ver', 'prontuario', 'ver', 'agent', array[]::text[], false, 'Ver o prontuário e o histórico clínico do paciente', true),
  ('prontuario.adendo', 'prontuario', 'adendo', 'agent', array['prontuario.ver']::text[], false, 'Acrescentar adendo a registro finalizado', true),
  ('prontuario.exportar', 'prontuario', 'exportar', 'manager', array['prontuario.ver']::text[], false, 'Exportar o prontuário do paciente', true),
  ('planos.ver', 'planos', 'ver', 'agent', array['prontuario.ver']::text[], false, 'Ver planos de tratamento e sessões', true),
  ('planos.gerenciar', 'planos', 'gerenciar', 'agent', array['planos.ver']::text[], false, 'Criar e alterar planos de tratamento e sessões', true),
  ('fotos.ver', 'fotos', 'ver', 'agent', array['prontuario.ver']::text[], false, 'Ver fotos clínicas (antes e depois)', true),
  ('fotos.enviar', 'fotos', 'enviar', 'agent', array['fotos.ver']::text[], false, 'Registrar fotos clínicas', true),
  ('anexos.ver', 'anexos', 'ver', 'agent', array['prontuario.ver']::text[], false, 'Ver e baixar anexos do prontuário', true),
  ('anexos.enviar', 'anexos', 'enviar', 'agent', array['anexos.ver']::text[], false, 'Anexar documentos e exames ao prontuário', true),
  ('documentos.ver', 'documentos', 'ver', 'agent', array[]::text[], false, 'Ver contratos e termos emitidos para o paciente', false),
  ('documentos.emitir', 'documentos', 'emitir', 'agent', array['documentos.ver']::text[], false, 'Emitir contrato ou termo para o paciente', false),
  ('documentos.colher_aceite', 'documentos', 'colher_aceite', 'agent', array['documentos.ver']::text[], false, 'Registrar o aceite do paciente', false),
  ('documentos.revogar', 'documentos', 'revogar', 'manager', array['documentos.ver']::text[], false, 'Revogar ou cancelar documento emitido', false),
  ('modelos_clinicos.gerenciar', 'modelos_clinicos', 'gerenciar', 'admin', array[]::text[], false, 'Configurar modelos de anamnese, avaliação e documentos (sem ver pacientes)', false)
on conflict (key) do update set
  modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
  depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao,
  clinica = excluded.clinica;

-- ─── permissões efetivas ───────────────────────────────────────────────────
create or replace function public.fn_member_permissions(p_org uuid)
returns setof text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_suporte jsonb;
  v_papel text;
  v_ligado boolean;
  v_profissional boolean;
begin
  if auth.uid() is null or p_org is null then
    return;
  end if;

  v_suporte := public.fn_support_context();
  if v_suporte ->> 'status' = 'active' and (v_suporte ->> 'organization_id')::uuid = p_org then
    -- 9016: suporte nunca lê conteúdo clínico.
    return query
      select c.key from public.clinic_permissions c
       where not c.clinica
         and (v_suporte ->> 'access_mode' = 'full' or c.nivel_base = 'viewer');
    return;
  end if;

  select uo.role into v_papel
    from public.user_organizations uo
   where uo.user_id = auth.uid() and uo.organization_id = p_org and uo.revoked_at is null
   limit 1;
  if v_papel is null then
    return;
  end if;

  select (o.settings -> 'clinic' -> 'acesso_por_permissoes') = 'true'::jsonb into v_ligado
    from public.organizations o where o.id = p_org;

  if not coalesce(v_ligado, false) then
    -- Transição: o que o nível legado já dava; chave clínica só para profissional ativo.
    select exists (
      select 1 from public.clinic_professionals p
       where p.organization_id = p_org and p.user_id = auth.uid() and p.is_active
    ) into v_profissional;
    return query
      select c.key from public.clinic_permissions c
       where public.fn_nivel_rank(c.nivel_base) <= public.fn_nivel_rank(v_papel)
         and (not c.clinica or v_profissional);
    return;
  end if;

  return query
    select distinct rp.permission_key
      from public.clinic_member_roles mr
      join public.clinic_roles r on r.organization_id = mr.organization_id and r.id = mr.role_id and r.ativo
      join public.clinic_role_permissions rp on rp.organization_id = r.organization_id and rp.role_id = r.id
      join public.clinic_permissions c on c.key = rp.permission_key
     where mr.organization_id = p_org and mr.user_id = auth.uid()
       -- 9016: o papel de sistema Administrador não concede conteúdo clínico.
       and not (c.clinica and r.system_key is not distinct from 'administrador');
end $$;
revoke execute on function public.fn_member_permissions(uuid) from public, anon;
grant  execute on function public.fn_member_permissions(uuid) to authenticated, service_role;

-- ─── provisionamento: papéis-modelo sem chave clínica ──────────────────────
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
      -- o Administrador tem todo o catálogo NÃO clínico (permissão nova entra sozinha)
      insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
      select p_org, v_id, c.key from public.clinic_permissions c
       where not c.clinica
      on conflict do nothing;
    end if;
  end loop;
end $$;
revoke execute on function public.fn_acesso_provisionar_org(uuid) from public, anon, authenticated;

-- ─── empresas que já existem ───────────────────────────────────────────────
-- Administrador recebe as chaves não-clínicas novas; os modelos não-sistema
-- recebem SÓ as chaves não-clínicas criadas nesta migration, pelo nível
-- (edição que a empresa fez nas chaves antigas não é tocada). Nenhum papel de
-- sistema fica com chave clínica.
do $$
declare
  o record;
begin
  for o in select id from public.organizations loop
    perform public.fn_acesso_provisionar_org(o.id);
  end loop;

  insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
  select r.organization_id, r.id, c.key
    from public.clinic_roles r
    join public.clinic_permissions c
      on c.key in ('atendimento.ver_fila','documentos.ver','documentos.emitir','documentos.colher_aceite','documentos.revogar')
   where r.system_key in ('gerente','atendente')
     and public.fn_nivel_rank(c.nivel_base) <= public.fn_nivel_rank(case r.system_key when 'gerente' then 'manager' else 'agent' end)
  on conflict do nothing;

  delete from public.clinic_role_permissions rp
   using public.clinic_roles r, public.clinic_permissions c
   where rp.organization_id = r.organization_id and rp.role_id = r.id
     and c.key = rp.permission_key and c.clinica
     and r.system_key is not null;
end $$;

-- ─── a opção: organizations.settings.clinic.prontuario ─────────────────────
create or replace function public.fn_clinic_definir_prontuario(p_org uuid, p_ligado boolean)
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

  select (o.settings -> 'clinic' -> 'prontuario') = 'true'::jsonb into v_antes
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
             || jsonb_build_object('prontuario', p_ligado),
           true)
   where id = p_org;

  return jsonb_build_object('ligado', p_ligado, 'mudou', coalesce(v_antes, false) <> p_ligado);
end $$;

revoke execute on function public.fn_clinic_definir_prontuario(uuid, boolean) from public, anon;
grant  execute on function public.fn_clinic_definir_prontuario(uuid, boolean) to authenticated;
