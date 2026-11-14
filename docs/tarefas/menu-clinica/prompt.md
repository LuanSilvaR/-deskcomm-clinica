/tarefa G menu-clinica Reorganizar a navegação do painel para o contexto de clínica

# Objetivo
Reorganizar o menu do painel (sidebar, hubs, ⌘K e tela inicial) em módulos de clínica de estética,
mantendo TODAS as telas existentes acessíveis e SEM alterar quem vê o quê. É reorganização de
apresentação: nenhuma rota, permissão, papel, tabela ou API muda de comportamento.

# Leia antes (Grep antes de Read)
- CLAUDE.md (regras invioláveis), skill deskcomm-doutrina e sistema-vivo ("por qual porta se chega até mim?").
- lib/navigation/catalogo.ts — ÚNICA lista de destinos. Leia os comentários: explicam minRole, hubs,
  densidade do sidebar e o limite de 900px.
- lib/navigation/registry.ts, lib/navigation/interface.ts, components/shell/{Sidebar,CommandPalette,NavHub}.tsx,
  app/app/page.tsx (homeDaInterface), app/app/layout.tsx.
- Cercas: tests/unit/navegacao-completude.test.ts, navegacao-registry.test.ts, i18n-catalogo-do-menu.test.ts,
  interface-por-{empresa,vinculo}.test.ts, lib/clinic/acesso/navegacao.test.ts, tests/e2e/navegacao.spec.ts.
- lib/clinic/flags.ts e a função fn_clinic_definir_flag (migration 9001).

# Restrições (não negociáveis)
1. CONTROLE DE ACESSO INTOCADO: nenhum `minRole`, `permissao`, `modulo`, `PORTAS_ESSENCIAIS`,
   `canSee`/`permitidos` muda. Nenhuma página ganha ou perde guarda. Prova obrigatória: teste que, para
   cada papel (viewer, agent, manager, admin, platform) e para o modo por permissões com 3 conjuntos
   (vazio, só agenda/pacientes, completo), o CONJUNTO de hrefs visíveis é idêntico com o menu novo e o antigo.
2. Nada é removido nem renomeado: todo href de NAV_CATALOG continua existindo e alcançável; hubs antigos
   (/app/crm, /app/ai, /app/analise, /app/settings) continuam respondendo. `interface_settings` guarda hrefs,
   então escolhas salvas pelas organizações continuam valendo.
3. Feature nasce DESLIGADA por organização (regra 7): flag `settings.clinic.menu_clinica`. Desligada =
   menu atual byte a byte (os testes atuais continuam passando sem edição). Ligada = menu novo.
   `fn_clinic_definir_flag` só conhece `profissionais` e NÃO se edita migration: criar migration TRIPLA
   `<ts>_9014_clinic_flag_menu.sql` (confirme o número: maior 9xxx + 1) com função nova
   `fn_clinic_definir_flag_menu(p_org, p_ligado)` nos mesmos moldes (admin, support write, MFA,
   `revoke ... from public, anon`) + linha no MANIFEST.md + apêndice idempotente em baseline.sql.
   Leitor `clinicMenuLigado(settings)` em lib/clinic/flags.ts com a mesma régua (só `true` liga).
4. Código novo em módulos clinic: `lib/clinic/navegacao/` (agrupamento clínica) e componentes em
   `components/clinic/`. Mudanças no core (catalogo/registry/Sidebar/CommandPalette/layout/app/app/page.tsx)
   mínimas, opcionais (parâmetro novo com default = comportamento atual) e registradas em UPSTREAM.md.
5. Todo texto novo (label, descrição, seção, "Em breve") com tradução `es` em lib/i18n/dicionario.ts.
6. Sem console.log, sem dados reais de paciente em fixtures/prints.

# Desenho
## Agrupamento clínico (sem tocar no `group` existente)
Em lib/clinic/navegacao/modulos.ts: `MODULOS_CLINICA` (ordem = uso diário) e um mapa
`href → { modulo, secao }` cobrindo 100% de NAV_CATALOG (teste reprova href sem módulo ou módulo sem href
existente). O registry recebe o agrupamento como parâmetro opcional; sem ele, usa NAV_GROUPS de sempre.

Mapa proposto (ajuste só se o código provar que algo encaixa melhor, e justifique no plano):
| Módulo | Telas existentes (href) | Em breve |
|---|---|---|
| Início | /app/inicio (NOVA) | — |
| Agenda | /app/agenda, /app/agenda/faltas, /app/agenda/profissionais, /app/recepcao, /app/agenda/indicadores, /app/settings/tenant/agenda (Tipos de agendamento) | — |
| Atendimento | /app/inbox, /app/radar, /app/templates, /app/calls, /app/metrics (Desempenho) | — |
| Pacientes | /app/contacts, /app/kanban (Jornada/Funis), /app/settings/tenant/pipelines | Prontuário, Fotos antes/depois |
| Contratos | — | Contratos e termos, Assinatura digital |
| LGPD | /app/lgpd/requests | Consentimentos |
| Procedimentos | /app/products | Protocolos, Pacotes |
| Equipamentos | — | Equipamentos, Manutenções |
| Profissionais | /app/settings/tenant/profissionais | Escalas |
| Financeiro | /app/faturamento, /app/comandas, /app/settings/tenant/financeiro | Contas a pagar/receber |
| Comissões | — | Regras de comissão, Extrato |
| Notas fiscais | — | Emissão NFS-e |
| Tarefas | /app/tasks, /app/activities | — |
| Marketing | /app/campaigns, /app/prospecting, /app/ads/meta, /app/settings/conversoes, /app/settings/meta-ads | — |
| Agente de IA | todas as /app/ai/* + /app/ai/evolution | — |
| Perfil e acesso | /app/settings/profile, /app/settings/security, /app/settings/notifications, /app/team, /app/settings/tenant/papeis, /app/audit | — |
| Configurações | /app/settings/tenant, /app/settings/atendimento, /app/settings/tags, /app/settings/marca, /app/settings/billing, /app/settings/api-tokens, /app/settings/voip-trunk, /app/extensions, /app/integracao-dados, seção "Canais": /app/connections, /app/webhooks, /app/integrations/nuvemshop | — |
Por que Atendimento, Marketing e Agente de IA existem além dos 14: são as telas de uso diário
(Inbox) e de captação/automação que não pertencem a nenhum módulo clínico; escondê-las dentro de
Pacientes ou Configurações aumentaria cliques para a recepção. Configurações e Perfil e acesso ficam
no rodapé fixo (como hoje o grupo Organização).

## Módulos "Em breve"
Lista `MODULOS_EM_BREVE` separada de NAV_CATALOG (não são rotas; não podem entrar na cerca de completude).
Aparecem no sidebar e no Início com selo "Em breve", `aria-disabled`, sem link, cor atenuada, tooltip
com uma frase do que virá. Quando um módulo for implementado, ele sai desta lista e entra no catálogo.
Módulo em breve só aparece se a flag do menu estiver ligada; não tem permissão (não abre nada).

## Sidebar com 17 módulos
Uma linha por módulo (ícone + nome). O módulo da rota atual expande e mostra suas telas visíveis
(filtradas pelo mesmo `destinosDaInterface`). Módulo sem nenhuma tela visível para o usuário some
(exceto "Em breve"). Deve caber sem scroll em 1280×900 (a spec e2e existente vale para o menu novo)
e colapsar corretamente no mobile. Teclado: setas/Enter, foco visível, `aria-expanded`, `aria-current`.

## Tela Início (/app/inicio) — duas fases
Fase 1: painel de módulos (grade de cards: ícone, nome, descrição, contagem de telas; em breve
desabilitado). Cards e links filtrados pela mesma função de acesso. Entra em NAV_CATALOG
(sem `minRole`/`permissao` — todo autenticado; porta essencial NÃO). Com a flag ligada,
`homeDaInterface` passa a preferir /app/inicio (parâmetro opcional; desligada = Inbox como hoje).
Fase 2 (PR separado): "Resumo do dia" no topo — agendamentos de hoje, faltas, tarefas vencendo,
conversas aguardando. Reutilize consultas/rotas já existentes das telas de origem; cada bloco só
aparece se o usuário tem a permissão da tela de origem; erro/sem permissão = bloco some, nunca quebra
a página. Sem tabela nova.

# Entregas e ordem
1. plano.md em docs/tarefas/menu-clinica/ (architect) → aprovação.
2. Flag + migration tripla (migration-guardian) + teste test:db de que só admin com MFA liga.
3. lib/clinic/navegacao (mapa + em breve) + parâmetro opcional no registry + testes unitários:
   cobertura 100% do catálogo, equivalência de acesso (restrição 1), i18n, flag desligada = menu antigo.
4. Sidebar/⌘K/hubs consumindo o agrupamento quando a flag está ligada (frontend + ux-accessibility).
5. /app/inicio fase 1 + home. 6. Fase 2 em PR próprio.

# Pronto quando
pnpm lint · pnpm typecheck · pnpm test:unit · pnpm test:db verdes, sem regressão de docs/baseline-testes.md;
e2e navegacao.spec.ts verde com flag desligada E ligada; prova em tela (Playwright, prints em 1280×900 e
390px) com viewer, agent, manager e admin mostrando menu novo e o mesmo conjunto de telas de antes;
regression-guardian + security-lgpd + code-reviewer aprovados; UPSTREAM.md atualizado; Conventional
Commits; PR para develop.
