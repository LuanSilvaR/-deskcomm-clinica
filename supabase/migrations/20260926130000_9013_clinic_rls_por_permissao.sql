-- ════════════════════════════════════════════════════════════════════════════
-- 9013 · clinic — RLS por permissão nas tabelas sensíveis (FORK, ACL-013)
-- ════════════════════════════════════════════════════════════════════════════
--
-- O navegador tem a anon key e o JWT do usuário: pode falar com o PostgREST
-- direto, sem passar pelas rotas. A trava real é a RLS. Aqui ela passa a
-- perguntar também a PERMISSÃO (fn_has_permission, 9009) nas tabelas sensíveis.
--
-- Policies RESTRITIVAS (AND com as permissivas que já existem): nada é
-- reescrito — as policies do upstream seguem intactas e podem mudar à vontade
-- numa sincronização. Com o modo por permissões DESLIGADO, fn_has_permission
-- responde exatamente o que o nível legado dava, e cada permissão abaixo tem
-- `nivel_base` igual ao nível que a policy permissiva já exigia — nada muda.
-- Ligado, um papel sem "Financeiro" não lê lançamento nem pelo PostgREST.
--
--   financial_entries, loyalty_ledger    ler: financeiro.ver   escrever: financeiro.lancar
--   financial_accounts, payment_methods  ler: financeiro.ver   escrever: financeiro.configurar
--   clinic_patient_profiles (ficha)      ler: pacientes.ver_ficha  escrever: pacientes.editar_ficha
--   clinic_specialties, clinic_professionals, clinic_professional_specialties,
--   clinic_event_type_specialties, clinic_resources, clinic_event_type_resources
--                                        escrever: profissionais.gerenciar
--   clinic_agenda_blocks                 escrever: agenda.bloquear_horario
-- (a LEITURA dessas configurações da agenda fica aberta à empresa: o motor de
-- horários livres lê pela sessão de quem marca.)
--
-- Plataforma (suporte autorizado) segue passando, como nas permissivas.
-- Service role e funções security definer não passam por RLS. Idempotente.

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('financial_entries',       'financeiro.ver',        'financeiro.lancar'),
      ('loyalty_ledger',          'financeiro.ver',        'financeiro.lancar'),
      ('financial_accounts',      'financeiro.ver',        'financeiro.configurar'),
      ('payment_methods',         'financeiro.ver',        'financeiro.configurar'),
      ('clinic_patient_profiles', 'pacientes.ver_ficha',   'pacientes.editar_ficha'),
      ('clinic_specialties',               null, 'profissionais.gerenciar'),
      ('clinic_professionals',             null, 'profissionais.gerenciar'),
      ('clinic_professional_specialties',  null, 'profissionais.gerenciar'),
      ('clinic_event_type_specialties',    null, 'profissionais.gerenciar'),
      ('clinic_resources',                 null, 'profissionais.gerenciar'),
      ('clinic_event_type_resources',      null, 'profissionais.gerenciar'),
      ('clinic_agenda_blocks',             null, 'agenda.bloquear_horario')
    ) as t(tabela, ler, escrever)
  loop
    if to_regclass('public.' || r.tabela) is null then
      continue;
    end if;
    execute format('drop policy if exists acesso_ler on public.%I', r.tabela);
    execute format('drop policy if exists acesso_inserir on public.%I', r.tabela);
    execute format('drop policy if exists acesso_alterar on public.%I', r.tabela);
    execute format('drop policy if exists acesso_excluir on public.%I', r.tabela);
    if r.ler is not null then
      execute format($p$create policy acesso_ler on public.%I as restrictive for select
                        using (public.fn_is_platform_admin() or public.fn_has_permission(organization_id, %L))$p$, r.tabela, r.ler);
    end if;
    execute format($p$create policy acesso_inserir on public.%I as restrictive for insert
                      with check (public.fn_is_platform_admin() or public.fn_has_permission(organization_id, %L))$p$, r.tabela, r.escrever);
    execute format($p$create policy acesso_alterar on public.%I as restrictive for update
                      using (public.fn_is_platform_admin() or public.fn_has_permission(organization_id, %L))
                      with check (public.fn_is_platform_admin() or public.fn_has_permission(organization_id, %L))$p$,
                   r.tabela, r.escrever, r.escrever);
    execute format($p$create policy acesso_excluir on public.%I as restrictive for delete
                      using (public.fn_is_platform_admin() or public.fn_has_permission(organization_id, %L))$p$, r.tabela, r.escrever);
  end loop;
end $$;
