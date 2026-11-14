-- ════════════════════════════════════════════════════════════════════════════
-- 9009 · clinic — papéis de acesso e permissões por empresa (FORK, ACL-002)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Controle de acesso EM CAMADAS (plano ACL):
--   clinic_permissions        — espelho do catálogo do código
--                               (lib/clinic/acesso/catalogo.ts). O cliente cria
--                               papéis; permissão arbitrária não existe (FK).
--   clinic_roles              — papéis de CADA empresa (Recepcionista…);
--                               `is_system` protege o Administrador.
--   clinic_role_permissions   — o que cada papel pode.
--   clinic_member_roles       — os papéis de cada membro (vários; a união vale).
--
-- FK COMPOSTA (organization_id, role_id) em tudo: um papel da empresa A não
-- pode ser atribuído nem receber permissão na empresa B, nem por engano.
--
-- Escrita SÓ pelas funções da 9010 (lock por empresa, regra de concessão,
-- antitravamento): nenhuma policy de escrita, e revoke de insert/update/delete.
--
-- Leitura das permissões EFETIVAS: `fn_member_permissions(org)`. Enquanto a
-- empresa não liga `settings.clinic.acesso_por_permissoes` (nasce desligada),
-- as permissões efetivas são EXATAMENTE as do nível legado (viewer/agent/
-- manager/admin → as chaves cujo nivel_base cabe nele) — nada muda. Ligada,
-- vêm dos papéis do membro. Suporte (impersonação): full = todas; somente
-- leitura = as de nível viewer.
-- Idempotente.

-- ─── catálogo ──────────────────────────────────────────────────────────────
create table if not exists public.clinic_permissions (
  key text primary key,
  modulo text not null,
  acao text not null,
  nivel_base text not null,
  depende_de text[] not null default '{}',
  critica boolean not null default false,
  descricao text not null,
  constraint clinic_permissions_nivel_check check (nivel_base in ('viewer','agent','manager','admin')),
  constraint clinic_permissions_chave_formato check (key = modulo || '.' || acao)
);

insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao) values
  ('agenda.ver', 'agenda', 'ver', 'viewer', array[]::text[], false, 'Ver a agenda, os horários livres e os compromissos'),
  ('agenda.marcar', 'agenda', 'marcar', 'agent', array['agenda.ver']::text[], false, 'Marcar compromisso'),
  ('agenda.remarcar', 'agenda', 'remarcar', 'agent', array['agenda.ver']::text[], false, 'Remarcar compromisso'),
  ('agenda.cancelar', 'agenda', 'cancelar', 'agent', array['agenda.ver']::text[], false, 'Cancelar compromisso'),
  ('agenda.registrar_desfecho', 'agenda', 'registrar_desfecho', 'agent', array['agenda.ver']::text[], false, 'Registrar "Compareceu" ou "Faltou"'),
  ('agenda.bloquear_horario', 'agenda', 'bloquear_horario', 'agent', array['agenda.ver']::text[], false, 'Bloquear horários e dias na agenda'),
  ('agenda.configurar', 'agenda', 'configurar', 'manager', array['agenda.ver']::text[], false, 'Tipos de atendimento, lembretes e prazos da agenda'),
  ('recepcao.ver_painel', 'recepcao', 'ver_painel', 'viewer', array[]::text[], false, 'Ver o painel da recepção e o status das visitas'),
  ('recepcao.mudar_status_visita', 'recepcao', 'mudar_status_visita', 'agent', array['recepcao.ver_painel']::text[], false, 'Avançar o status da visita (chegou, pronto, em atendimento, finalizado)'),
  ('recepcao.corrigir_status', 'recepcao', 'corrigir_status', 'agent', array['recepcao.ver_painel', 'recepcao.mudar_status_visita']::text[], false, 'Voltar o status da visita (correção com motivo)'),
  ('pacientes.ver', 'pacientes', 'ver', 'viewer', array[]::text[], false, 'Ver pacientes e o histórico'),
  ('pacientes.criar', 'pacientes', 'criar', 'agent', array['pacientes.ver']::text[], false, 'Cadastrar paciente'),
  ('pacientes.editar', 'pacientes', 'editar', 'agent', array['pacientes.ver']::text[], false, 'Editar paciente'),
  ('pacientes.excluir', 'pacientes', 'excluir', 'agent', array['pacientes.ver']::text[], false, 'Excluir paciente'),
  ('pacientes.importar', 'pacientes', 'importar', 'agent', array['pacientes.ver']::text[], false, 'Importar pacientes de planilha'),
  ('pacientes.mesclar', 'pacientes', 'mesclar', 'manager', array['pacientes.ver']::text[], false, 'Juntar cadastros duplicados'),
  ('pacientes.ver_ficha', 'pacientes', 'ver_ficha', 'viewer', array['pacientes.ver']::text[], false, 'Ver a ficha cadastral (CPF, endereço, responsável)'),
  ('pacientes.editar_ficha', 'pacientes', 'editar_ficha', 'agent', array['pacientes.ver', 'pacientes.ver_ficha']::text[], false, 'Preencher e alterar a ficha cadastral'),
  ('conversas.ver', 'conversas', 'ver', 'viewer', array[]::text[], false, 'Ver as conversas'),
  ('conversas.responder', 'conversas', 'responder', 'agent', array['conversas.ver']::text[], false, 'Responder e iniciar conversas'),
  ('conversas.transferir', 'conversas', 'transferir', 'agent', array['conversas.ver']::text[], false, 'Assumir, transferir e liberar conversas'),
  ('conversas.encerrar', 'conversas', 'encerrar', 'agent', array['conversas.ver']::text[], false, 'Encerrar e adiar conversas'),
  ('conversas.notas', 'conversas', 'notas', 'agent', array['conversas.ver']::text[], false, 'Notas internas nas conversas'),
  ('conversas.respostas_rapidas', 'conversas', 'respostas_rapidas', 'agent', array['conversas.ver']::text[], false, 'Criar e editar respostas rápidas'),
  ('crm.ver', 'crm', 'ver', 'viewer', array[]::text[], false, 'Ver funis e negócios'),
  ('crm.criar', 'crm', 'criar', 'agent', array['crm.ver']::text[], false, 'Criar negócio'),
  ('crm.editar', 'crm', 'editar', 'agent', array['crm.ver']::text[], false, 'Editar e mover negócio'),
  ('crm.configurar_funis', 'crm', 'configurar_funis', 'manager', array['crm.ver']::text[], false, 'Criar e alterar funis e etapas'),
  ('tarefas.ver', 'tarefas', 'ver', 'viewer', array[]::text[], false, 'Ver tarefas'),
  ('tarefas.gerenciar', 'tarefas', 'gerenciar', 'agent', array['tarefas.ver']::text[], false, 'Criar, editar e concluir tarefas'),
  ('campanhas.ver', 'campanhas', 'ver', 'manager', array[]::text[], false, 'Ver campanhas e automações'),
  ('campanhas.gerenciar', 'campanhas', 'gerenciar', 'manager', array['campanhas.ver']::text[], false, 'Criar, enviar e pausar campanhas e automações'),
  ('ia.ver', 'ia', 'ver', 'agent', array[]::text[], false, 'Ver agentes de IA e o que fizeram'),
  ('ia.configurar', 'ia', 'configurar', 'manager', array['ia.ver']::text[], false, 'Configurar agentes, conhecimento e follow-ups'),
  ('ia.administrar', 'ia', 'administrar', 'admin', array['ia.ver', 'ia.configurar']::text[], false, 'Credenciais, publicação e orçamento de IA'),
  ('canais.gerenciar', 'canais', 'gerenciar', 'admin', array[]::text[], false, 'Conectar e configurar o WhatsApp e outros canais'),
  ('financeiro.ver', 'financeiro', 'ver', 'viewer', array[]::text[], false, 'Ver lançamentos, comandas e fidelidade'),
  ('financeiro.lancar', 'financeiro', 'lancar', 'agent', array['financeiro.ver']::text[], false, 'Abrir comanda, lançar itens e finalizar'),
  ('financeiro.estornar', 'financeiro', 'estornar', 'manager', array['financeiro.ver']::text[], false, 'Estornar comanda e excluir lançamento'),
  ('financeiro.configurar', 'financeiro', 'configurar', 'manager', array['financeiro.ver']::text[], false, 'Catálogo financeiro e regras'),
  ('produtos.ver', 'produtos', 'ver', 'viewer', array[]::text[], false, 'Ver produtos'),
  ('produtos.gerenciar', 'produtos', 'gerenciar', 'manager', array['produtos.ver']::text[], false, 'Cadastrar, importar e alterar produtos'),
  ('profissionais.ver', 'profissionais', 'ver', 'viewer', array[]::text[], false, 'Ver profissionais, especialidades e salas'),
  ('profissionais.gerenciar', 'profissionais', 'gerenciar', 'manager', array['profissionais.ver']::text[], false, 'Cadastrar profissionais, especialidades, salas e exigências'),
  ('relatorios.ver', 'relatorios', 'ver', 'agent', array[]::text[], false, 'Ver desempenho e faltas'),
  ('relatorios.gerencial', 'relatorios', 'gerencial', 'manager', array['relatorios.ver']::text[], false, 'Ver indicadores gerenciais da agenda'),
  ('equipe.ver', 'equipe', 'ver', 'manager', array[]::text[], true, 'Ver a equipe e os convites'),
  ('equipe.convidar', 'equipe', 'convidar', 'admin', array['equipe.ver']::text[], false, 'Convidar e reenviar convites'),
  ('equipe.revogar', 'equipe', 'revogar', 'admin', array['equipe.ver']::text[], false, 'Revogar e reativar acesso de membros'),
  ('equipe.atribuir_papeis', 'equipe', 'atribuir_papeis', 'admin', array['equipe.ver', 'papeis.ver']::text[], true, 'Dar e tirar papéis de acesso dos membros'),
  ('papeis.ver', 'papeis', 'ver', 'admin', array[]::text[], true, 'Ver os papéis de acesso e as permissões'),
  ('papeis.gerenciar', 'papeis', 'gerenciar', 'admin', array['papeis.ver']::text[], true, 'Criar, editar, duplicar, desativar e excluir papéis'),
  ('configuracoes.ver', 'configuracoes', 'ver', 'manager', array[]::text[], false, 'Ver as configurações da empresa'),
  ('configuracoes.gerenciar', 'configuracoes', 'gerenciar', 'manager', array['configuracoes.ver']::text[], false, 'Alterar configurações da empresa (roteamento, campanhas, marca)'),
  ('configuracoes.opcoes_da_clinica', 'configuracoes', 'opcoes_da_clinica', 'admin', array['configuracoes.ver']::text[], false, 'Ligar e desligar as opções da clínica'),
  ('configuracoes.tokens_e_integracoes', 'configuracoes', 'tokens_e_integracoes', 'admin', array['configuracoes.ver']::text[], false, 'Tokens de API, webhooks e integrações'),
  ('lgpd.ver', 'lgpd', 'ver', 'admin', array[]::text[], false, 'Ver pedidos LGPD'),
  ('lgpd.tratar', 'lgpd', 'tratar', 'admin', array['lgpd.ver']::text[], false, 'Aprovar pedidos e anonimizar titulares'),
  ('auditoria.ver', 'auditoria', 'ver', 'manager', array[]::text[], false, 'Ver o registro de auditoria'),
  ('extensoes.ver', 'extensoes', 'ver', 'viewer', array[]::text[], false, 'Ver extensões disponíveis'),
  ('extensoes.ativar', 'extensoes', 'ativar', 'admin', array['extensoes.ver']::text[], false, 'Ativar, configurar e desativar extensões')
on conflict (key) do update set
  modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
  depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao;

-- ─── papéis ────────────────────────────────────────────────────────────────
create table if not exists public.clinic_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null,
  descricao text,
  is_system boolean not null default false,
  system_key text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_roles_nome_tamanho check (char_length(btrim(nome)) between 1 and 60),
  constraint clinic_roles_descricao_tamanho check (descricao is null or char_length(descricao) <= 300),
  constraint clinic_roles_org_id_key unique (organization_id, id)
);
create unique index if not exists clinic_roles_org_nome_key on public.clinic_roles (organization_id, lower(btrim(nome)));
create unique index if not exists clinic_roles_org_system_key on public.clinic_roles (organization_id, system_key) where system_key is not null;

drop trigger if exists clinic_roles_updated_at on public.clinic_roles;
create trigger clinic_roles_updated_at before update on public.clinic_roles
  for each row execute function public.fn_set_updated_at();

create table if not exists public.clinic_role_permissions (
  organization_id uuid not null,
  role_id uuid not null,
  permission_key text not null references public.clinic_permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key),
  constraint clinic_role_permissions_papel_da_org foreign key (organization_id, role_id)
    references public.clinic_roles (organization_id, id) on delete cascade
);
create index if not exists clinic_role_permissions_org_idx on public.clinic_role_permissions (organization_id, role_id);

create table if not exists public.clinic_member_roles (
  organization_id uuid not null,
  user_id uuid not null,
  role_id uuid not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id, role_id),
  constraint clinic_member_roles_papel_da_org foreign key (organization_id, role_id)
    references public.clinic_roles (organization_id, id) on delete cascade,
  constraint clinic_member_roles_membro foreign key (user_id, organization_id)
    references public.user_organizations (user_id, organization_id) on delete cascade
);
create index if not exists clinic_member_roles_role_idx on public.clinic_member_roles (role_id);

-- ─── RLS: leitura por empresa; escrita só pelas funções (9010) ─────────────
alter table public.clinic_permissions enable row level security;
drop policy if exists clinic_permissions_select on public.clinic_permissions;
create policy clinic_permissions_select on public.clinic_permissions for select to authenticated using (true);
revoke all on public.clinic_permissions from anon;
revoke insert, update, delete, truncate on public.clinic_permissions from authenticated;

do $$
declare t text;
begin
  foreach t in array array['clinic_roles','clinic_role_permissions','clinic_member_roles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format('drop policy if exists %s_select on public.%I', t, t);
    execute format($p$create policy %s_select on public.%I for select using (
        (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin())$p$, t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;

-- ─── leitura das permissões efetivas ───────────────────────────────────────
create or replace function public.fn_nivel_rank(p_nivel text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_nivel when 'viewer' then 1 when 'agent' then 2 when 'manager' then 3 when 'admin' then 4 else 0 end
$$;
revoke execute on function public.fn_nivel_rank(text) from public, anon;
grant  execute on function public.fn_nivel_rank(text) to authenticated, service_role;

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
begin
  if auth.uid() is null or p_org is null then
    return;
  end if;

  v_suporte := public.fn_support_context();
  if v_suporte ->> 'status' = 'active' and (v_suporte ->> 'organization_id')::uuid = p_org then
    return query
      select c.key from public.clinic_permissions c
       where v_suporte ->> 'access_mode' = 'full' or c.nivel_base = 'viewer';
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
    -- Transição: exatamente o que o nível legado já dava.
    return query
      select c.key from public.clinic_permissions c
       where public.fn_nivel_rank(c.nivel_base) <= public.fn_nivel_rank(v_papel);
    return;
  end if;

  return query
    select distinct rp.permission_key
      from public.clinic_member_roles mr
      join public.clinic_roles r on r.organization_id = mr.organization_id and r.id = mr.role_id and r.ativo
      join public.clinic_role_permissions rp on rp.organization_id = r.organization_id and rp.role_id = r.id
     where mr.organization_id = p_org and mr.user_id = auth.uid();
end $$;
revoke execute on function public.fn_member_permissions(uuid) from public, anon;
grant  execute on function public.fn_member_permissions(uuid) to authenticated, service_role;

create or replace function public.fn_has_permission(p_org uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.fn_member_permissions(p_org) k where k = p_key)
$$;
revoke execute on function public.fn_has_permission(uuid, text) from public, anon;
grant  execute on function public.fn_has_permission(uuid, text) to authenticated, service_role;
