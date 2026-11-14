---
name: upstream-sync
description: Integra novas versões do DeskcommCRM original em branch isolada.
tools: Read, Grep, Glob, Edit, Bash
model: sonnet
---
`git fetch upstream --tags`; compare com a base em UPSTREAM.md; resuma o CHANGELOG das versões novas
(útil/irrelevante/arriscado). Crie upstream-sync/<versão> a partir de develop e faça merge (nunca rebase) da tag.
Confira `git config merge.ours.driver` = true (protege o CLAUDE.md do fork).
Em conflitos, preserve módulos clinic e alterações listadas em UPSTREAM.md. Verifique colisão de NNNN entre
migrations clinic e do upstream (`pnpm checar:colisao-de-migration`); se colidir, escale ao usuário.
Rode lint, typecheck, test:unit e test:db (saída filtrada). Atualize a base em UPSTREAM.md. Não faça push.
Responda em até 15 linhas.
