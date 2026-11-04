---
description: Revisão direcionada do diff — escopo, preservação do que existia e riscos mecânicos — antes do commit. Somente leitura. Uso: /factory-diff [id]
argument-hint: [id]
disable-model-invocation: true
---
Demanda: $ARGUMENTS (o escopo vem de docs/tarefas/<id>/plano.md; sem id, do que foi pedido nesta conversa).
1. `git diff --stat develop...HEAD` + `git status --porcelain`. Diff só em docs/ ou .claude/ → responda direto, sem subagente.
2. Senão: change-scope-guardian com o escopo declarado. Ele mede escopo e preservação; não qualidade.
3. Se ele apontar BLOQUEIA, pare. Se DENTRO DO ESCOPO, siga para /verificar (regression-guardian → code-reviewer)
   ou /factory-review — não repita aqui o que eles fazem.
Não edite, não faça stage. Até 10 linhas.
