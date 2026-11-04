---
description: Executa uma demanda planejada (modo IMPLEMENT) — implementa, testa e revisa com a menor equipe. Uso: /factory-implement <id> [LOW|MEDIUM|HIGH]
argument-hint: <id> [nível]
disable-model-invocation: true
---
Argumentos: $ARGUMENTS
O fluxo É o do /tarefa (.claude/commands/tarefa.md): LOW=P, MEDIUM=M, HIGH=G. Leia-o e siga-o; este comando
só acrescenta as regras da fábrica abaixo. Se docs/tarefas/<id>/plano.md existe, ele manda; em HIGH sem plano
aprovado pelo dono, pare e rode /factory-plan.
- Antes: `git status -sb`; branch feature/<id> a partir de develop; não descarte trabalho local.
- Equipe por área (docs/factory/AGENTS.md): banco → migration-guardian; rota → backend; tela → frontend;
  fatia pequena front+back → fullstack-developer; integração externa → integration; infra/CI → devops-engineer.
- Paralelo só entre tarefas independentes sem arquivo em comum; quem edita em paralelo usa worktree.
- Máximo 2 ciclos automáticos revisão↔correção; no 3º pare e liste bloqueios.
- Gates de docs/factory/QUALITY_GATES.md proporcionais ao nível. Gate obrigatório falhou = não declare entrega.
- Fechamento: technical-writer só se docs mudaram de fato. NÃO faça push/PR sem ok do dono.
Relatório no contrato de docs/factory/templates/contrato-agente.md (implementado / testado com exit code /
revisado / aprovado / pendente). LOW: até 5 linhas.
