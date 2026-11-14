-- ════════════════════════════════════════════════════════════════════════════
-- 9042 · clinic — agenda: ver a agenda de OUTROS profissionais (FORK, agenda S1)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Plano: agenda por profissional (Sprint 1). A agenda passa a mostrar UM
-- profissional por vez; quem pode trocar para o de um colega é quem tem
-- `agenda.ver_outros`. Sem ela, a agenda (e as rotas que a alimentam) mostra só
-- a do próprio usuário.
--
-- Nível base `viewer`: no modo legado (sem papéis) e nos papéis de sistema todo
-- mundo continua vendo a agenda da equipe, como hoje — nada muda para quem já
-- usa. Restringir o profissional clínico à própria agenda é um papel
-- personalizado sem esta chave (tela Papéis de acesso).
--
-- A regra vale na API (as rotas da agenda forçam o dono). A RLS de
-- `calendar_appointments` segue a do núcleo: Inbox, IA e MCP também leem ali.
-- Idempotente.

insert into public.clinic_permissions (key, modulo, acao, nivel_base, depende_de, critica, descricao, clinica) values
  ('agenda.ver_outros', 'agenda', 'ver_outros', 'viewer', array['agenda.ver']::text[], false,
   'Ver a agenda de outros profissionais (sem ela, só a própria)', false)
on conflict (key) do update
  set modulo = excluded.modulo, acao = excluded.acao, nivel_base = excluded.nivel_base,
      depende_de = excluded.depende_de, critica = excluded.critica, descricao = excluded.descricao,
      clinica = excluded.clinica;

-- Papéis de sistema: todos têm (nível viewer). Papéis personalizados que já
-- veem a agenda também ganham, para nada sumir de quem usa hoje.
insert into public.clinic_role_permissions (organization_id, role_id, permission_key)
select r.organization_id, r.id, 'agenda.ver_outros'
  from public.clinic_roles r
 where r.system_key in ('administrador', 'gerente', 'atendente', 'visualizador')
    or exists (select 1 from public.clinic_role_permissions rp
                where rp.role_id = r.id and rp.permission_key = 'agenda.ver')
on conflict do nothing;
