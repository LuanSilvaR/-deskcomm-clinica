---
description: Mostra o andamento das demandas (quadro, issues, PRs, CI, handoffs) com bloqueios e próximo passo. Somente leitura. Uso: /factory-status [id|épico]
argument-hint: [id ou épico]
disable-model-invocation: true
---
Filtro: $ARGUMENTS (vazio = itens fora de Backlog e Concluído). Use o subagente scrum-master.
Fonte: issues/labels/PRs + quadro (docs/backlog.md) e docs/tarefas/<id>/handoff.md. Não mude nada.
Responda com uma tabela curta: item | estágio | último sinal | bloqueio | próximo passo.
