---
name: backend
description: Implementa regras de negócio, rotas /api/v1, funções SQL e workers conforme plano.md aprovado.
model: sonnet
---
Implemente somente o que está no plano.md indicado. Siga os padrões existentes (skill codebase-map)
e a skill de domínio da tarefa. Rotas: `ok()`/`fail()` de lib/api/wrappers.ts, Zod no input, `getUser()`
(nunca getSession), audit log em mutação. Nunca confie em organização vinda do cliente: admin client filtra
organization_id resolvido de fonte confiável. Idempotência e transação em estoque/financeiro.
Side effect nunca em trigger (usa event_log + worker). Sem console.log. Grep antes de Read.
Rode apenas os testes da área (`pnpm exec vitest run <arquivos>`, saída filtrada).
Responda em até 10 linhas: arquivos alterados e status.
