# Contexto do projeto (para os agentes)

> Resumo para orientar. Medido em 2026-11-04 sobre `origin/develop` @ a4a9a5b44. Atualize com `/factory-init`.
> Estado real de implementação: [docs/current-state.md](../current-state.md) e [docs/funcionalidades.md](../funcionalidades.md).

## O sistema

SaaS multi-tenant para **clínicas de estética**, construído como fork do DeskcommCRM (CRM de atendimento
por WhatsApp com agentes de IA). O fork acrescenta o domínio clínico: agenda por profissional, pacientes,
prontuário, procedimentos/POPs, estoque, planos, documentos e confirmação. **Está em produção** (VPS).
Controle do que veio do upstream e do que o fork alterou: [UPSTREAM.md](../../UPSTREAM.md).

## Stack (de `package.json`)

Next.js 16 (App Router; borda em `proxy.ts`) · React 19 · TypeScript estrito · Supabase (Postgres + RLS,
Auth, Realtime, Storage) · Tailwind 4 (CSS-first) + shadcn/ui · Zod 4 · Vercel AI SDK · Sentry ·
Vitest 4 (unit, db, cercas) · Playwright · pnpm 9 / Node 22 · Docker (app, worker, scheduler, voice-agent).

## Onde está o quê

| Área | Caminho |
|---|---|
| Telas autenticadas | `app/app/<área>` (agenda, estoque, procedimentos, recepcao, meu-dia, inbox, crm…) |
| API | `app/api/v1/…` — respostas `ok()`/`fail()`, Zod no input |
| Domínio clínico (fork) | `lib/clinic/<domínio>` · flags em `lib/clinic/flags.ts` · `components/clinic` |
| Domínio do upstream | `lib/<domínio>` (agent-engine, ai, inbox, kanban, followup, waha, lgpd…) |
| UI base | `components/ui` (shadcn) · navegação em `lib/navigation/` |
| Workers / filas | `workers/` consumindo `event_log` (trigger nunca faz HTTP) |
| Banco | `supabase/baseline.sql` (instalação) · `supabase/migrations/` + `MANIFEST.md` |
| Testes | `tests/unit`, `tests/db`, `tests/invariants` (isolamento RLS), `tests/e2e`, `tests/api` |
| Infra | `Dockerfile*`, `docker-compose.*.yml`, `infra/`, `.github/workflows/` |

## Convenções que mais pesam

Todas estão no [CLAUDE.md](../../CLAUDE.md) (regras invioláveis 1–9). As que mais derrubam PR:
código novo em `clinic`/`clinic_*`; migration TRIPLA na faixa 8xxx (desde 2026-11-04); `getUser()` e nunca `getSession()`;
`organization_id` de fonte confiável; feature nasce desligada por organização; prontuário assinado é
imutável; sem dados reais de paciente; Conventional Commits em pt-BR.

## Integrações

WhatsApp (WAHA), IA (Anthropic primário via AI Gateway), Upstash Redis (rate limit), Sentry, Resend (e-mail),
Google Agenda. Detalhes e limites: [ARCHITECTURE.md da raiz](../../ARCHITECTURE.md) e `docs/architecture/*.architecture.json`.
