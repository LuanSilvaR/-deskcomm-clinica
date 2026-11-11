# Task 6 report
UI: card in Profissionais, AnonymizeDialog (code + Baixar), AtestadoDoPaciente (contact LGPD tab), AtestadosPanel (LGPD page), i18n, e2e spec registered in SPECS_PARTE_5.
Run spec (controller, 3001 on this branch): pnpm exec playwright test tests/e2e/lgpd-atestado-anonimizacao.spec.ts
Checks: typecheck 0, lint 0, vitest e2e-cobertura-completa 0. Playwright NOT run.
Screenshots go to evidence/87-atestado-anonimizacao/ (needs citing in a .md per CLAUDE.md).

## Playwright run
Result: 1 passed (~54s) on port 3001, no spec/UI changes needed. Exit 127 + UV_HANDLE_CLOSING = known Node defect on Windows.
Playwright config always spawns its own server (reuseExistingServer false) and 3001 was taken, so I ran with a throwaway config (not committed) that only flips reuseExistingServer to true. .env.e2e was copied from ../desenvolvimento (gitignored; `pnpm e2e:env` failed: Supabase CLI not up).
The flag is turned off in a `finally` block. Screenshots 01..06 committed under evidence/87-atestado-anonimizacao/.

## Fix round 1
Dialog download button now has data-testid="atestado-baixar-dialogo" (contact page keeps "atestado-baixar"); spec points at the dialog id. typecheck 0, lint 0, spec re-run on 3001: 1 passed (26.6s; UV_HANDLE_CLOSING exit 127 is the known Windows defect). Screenshots regenerated.
