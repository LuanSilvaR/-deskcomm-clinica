# Plano — gerar o prompt "Menu da Clínica" (reorganização do painel)

## Contexto
O painel hoje é agrupado pela lógica de CRM genérico (Atendimento, CRM, Agente de IA, Canais, Análise
+ Organização no rodapé). O dono quer a navegação pensada para a clínica, com 14 módulos
(Início…Configurações), módulos futuros visíveis como "Em breve", **sem remover nenhuma tela** e
**sem mexer no controle de acesso**. O prompt está em `docs/tarefas/menu-clinica/prompt.md` e foi
executado na branch isolada `claude/clinic-admin-panel-reorganization-6u6dgv` (a partir de develop).

Fatos do código que o prompt usa (medidos):
- Única fonte do menu: `lib/navigation/catalogo.ts` (`NAV_GROUPS`, `NAV_CATALOG`, `GRUPO_NO_RODAPE`).
  Sidebar (`components/shell/Sidebar.tsx`), hubs (`NavHub`), ⌘K (`CommandPalette.tsx`) são projeções via
  `lib/navigation/registry.ts` (`sidebarGroups`, `hubSections`, `searchable`).
- Acesso: `minRole` + `permissao` (ACL-008) + `modulo`, decididos em `lib/navigation/interface.ts`
  (`canSee`, `permitidos`, `destinosDaInterface`, `PORTAS_ESSENCIAIS`, `homeDaInterface`). Menu é
  apresentação; quem recusa é página/rota.
- `interface_settings` guarda **hrefs**, não ids de grupo → reagrupar não invalida dados salvos.
- Cercas: `tests/unit/navegacao-{completude,registry}.test.ts`, `i18n-catalogo-do-menu.test.ts`
  (todo label/descrição/seção precisa de `es` em `lib/i18n/dicionario.ts`),
  `lib/clinic/acesso/navegacao.test.ts`, `tests/e2e/navegacao.spec.ts` (menu cabe sem scroll em 900px).
- Flag clinic: `lib/clinic/flags.ts` + `fn_clinic_definir_flag` (migration 9001) — só conhece a chave
  `profissionais`; flag nova exige migration nova (maior 9xxx hoje = 9013 → 9014).

## Decisão de UX (usuário delegou)
14 módulos pedidos + 2 que acomodam o que não se enquadra, sem "Canais"/"Análise" soltos:
**Atendimento** (conversa com paciente) e **Marketing** (captação). **Agente de IA** fica como módulo
próprio porque tem 14 telas e público próprio (gestor).
Relatórios se distribuem pelo contexto (cada módulo tem sua seção "Indicadores"). Sidebar vira lista de
módulos (1 linha cada) com o módulo ativo expandido — resolve o limite de 900px com 17 módulos.
Início = painel de módulos + resumo do dia (em 2 fases).

## Ação após aprovação (usuário pediu: executar o prompt, em branch separada)
Branch isolada: `claude/clinic-admin-panel-reorganization-6u6dgv`, criada a partir de `origin/develop`
(HEAD atual = develop 09120000). Nada vai para develop/main; merge só por PR quando o usuário pedir.
Se develop andar durante o trabalho: `git merge origin/develop` (nunca rebase).

Commits (Conventional), na ordem:
1. `docs(clinic): prompt e plano da reorganização do menu` — docs/tarefas/menu-clinica/{prompt,plano}.md.
2. `feat(clinic): flag menu_clinica` — migration tripla 9014 + `clinicMenuLigado` + teste test:db.
3. `feat(clinic): agrupamento clínico da navegação` — lib/clinic/navegacao + parâmetro opcional no
   registry/interface + testes (cobertura do catálogo, equivalência de acesso por papel/permissões, i18n).
4. `feat(clinic): sidebar e ⌘K por módulos de clínica` — Sidebar/CommandPalette/layout lendo a flag.
5. `feat(clinic): tela Início com painel de módulos` + home preferindo /app/inicio com a flag.
6. `feat(clinic): resumo do dia no Início` — reusa consultas existentes, bloco por permissão.
7. UPSTREAM.md + docs/backlog.md atualizados.

Gates antes de cada push: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:db`,
`pnpm test:e2e` (navegacao.spec com flag desligada e ligada) + prints Playwright 1280×900 e 390px.
Push: `git push -u origin claude/clinic-admin-panel-reorganization-6u6dgv`.

## Como baixar e testar na sua máquina (vai no final da resposta e em docs/tarefas/menu-clinica/testar.md)
1. `git fetch origin && git switch claude/clinic-admin-panel-reorganization-6u6dgv`
   (primeira vez: `git switch -c claude/clinic-admin-panel-reorganization-6u6dgv origin/claude/clinic-admin-panel-reorganization-6u6dgv`).
2. `pnpm install` (Node 22, pnpm 9).
3. Banco de teste (NUNCA o de produção): aplicar só o apêndice novo do `supabase/baseline.sql`
   (é idempotente) ou subir banco fresco com baseline + `scripts/bootstrap-owner.ts`.
4. `pnpm dev` → entrar como admin → ligar a flag: Configurações › Organização (ou SQL
   `select fn_clinic_definir_flag_menu('<org_id>', true)` logado como admin com MFA).
5. Conferir: menu por módulos, "Em breve" desabilitado, Início abre por padrão; entrar com usuário
   viewer/atendente e ver que as mesmas telas de antes continuam (nem mais, nem menos).
6. Desligar a flag → menu antigo volta idêntico (é o rollback).
7. Gates locais: `pnpm lint && pnpm typecheck && pnpm test:unit` (e `pnpm test:e2e` se tiver Playwright).
Para voltar ao código normal: `git switch develop`.

---
