# SaaS Clínicas de Estética — fork do DeskcommCRM (EM PRODUÇÃO)
Stack: Next.js 16 · React 19 · TS estrito · Supabase (Postgres+RLS) · Tailwind 4 (CSS-first) + shadcn/ui.
Doutrina completa do upstream: `AGENTS.md` e skill `deskcomm-doutrina` (leia só o trecho necessário).
Guias embutidos (.claude/skills): `deskcomm-instalar`, `deskcomm-cliente-novo`, `deskcomm-metricas`, `deskcomm-prompt`,
`deskcomm-contribuir`, `deskcomm-extensao`, `deskcomm-doutrina`.
Mapa do código: skill `codebase-map` (Sessão 2). Backlog: docs/backlog.md. Controle do fork: UPSTREAM.md.
Este arquivo usa `merge=ours` (.gitattributes): o CLAUDE.md do upstream NÃO entra nas sincronizações.

## Comandos (pnpm 9, Node 22)
lint: `pnpm lint` · tipos: `pnpm typecheck` · unit: `pnpm test:unit` (sem caminho — alcança o repo todo)
banco/RLS: `pnpm test:db` (Postgres efêmero + baseline + invariantes) · build: `pnpm build` · e2e: `pnpm test:e2e`
Saída longa: redirecione para arquivo e filtre; o EXIT CODE é a autoridade, o rodapé só explica.
Banco fresco = `supabase/baseline.sql` + `scripts/bootstrap-owner.ts`. A cadeia `migrations/` não sobe do zero:
NÃO use `supabase db reset` como prova.

## Regras invioláveis
1. Mudanças aditivas e reversíveis. Nada de remover/renomear coluna, rota ou prop em uso (expand/contract).
2. Código novo em módulos `clinic` e tabelas `clinic_*`. Alterar o core só com aprovação; registrar em UPSTREAM.md.
3. Tabela nova tenant-aware = `organization_id uuid not null references organizations(id) on delete cascade`
   + RLS `tenant_isolation_<tabela>_all` via `fn_user_org_ids()` + teste de isolamento (2 orgs) em tests/invariants.
4. Migration = TRIPLA: arquivo `supabase/migrations/<ts>_<NNNN>_clinic_<slug>.sql` + linha no MANIFEST.md
   + apêndice idempotente no fim de `supabase/baseline.sql` (é o que a instalação aplica). NNNN = maior + 1
   (`ls supabase/migrations | grep -oE '_[0-9]{4}_' | tr -d _ | sort -n | tail -1`).
5. Nunca editar migration existente. Função nova em `public`: `revoke execute ... from public, anon`.
6. Auth: `getUser()`, nunca `getSession()`. Admin client (service role) filtra `organization_id` resolvido de
   fonte confiável (cookie/JWT/token), NUNCA do body. Zod em todo input externo. Respostas via `ok()`/`fail()`.
7. Feature nova nasce desligada (flag por organização). Estoque = soma de movimentos. Prontuário assinado
   é imutável (correção por adendo). Trigger Postgres nunca faz HTTP (usa `event_log`).
8. Sem dados reais de pacientes em código, testes, logs ou prompts. Sem `console.log` em código merged.
9. Conventional Commits. Pronto = lint + tipos + test:unit (+ test:db se tocou banco) verdes, sem regressão
   do baseline (docs/baseline-testes.md). Tocou UI: provar pela tela (Playwright).

## Branches
`main` = produção (só via PR). `develop` = integração. Trabalho em `feature/<id>` a partir de develop.
Nunca `reset --hard`/force push. Atualize com merge de develop, nunca rebase de branch publicada.

## Economia
Grep antes de Read. Planos e handoffs em docs/tarefas/<id>/. Respostas curtas. Fluxo P/M/G: comando /tarefa.
