---
description: Planeja uma demanda — classifica LOW/MEDIUM/HIGH, escolhe a menor equipe e escreve o plano. Modo PLAN, não altera código. Uso: /factory-plan <id> <demanda>
argument-hint: <id> <demanda>
disable-model-invocation: true
---
Demanda: $ARGUMENTS
Modo PLAN: nenhuma edição fora de docs/tarefas/<id>/. Regras: docs/factory/WORKFLOWS.md e docs/factory/AGENTS.md.
1. `git status -sb`. Classifique o nível pelo RISCO (WORKFLOWS.md §Classificação) e diga por quê em 1 linha.
   MEDIUM/HIGH: procure trabalho em andamento na mesma área antes de planejar —
   `gh pr list -R LuanSilvaR/-deskcomm-clinica --state open --search "<termo>"` e `gh issue list` idem. Sobreposição = risco no plano.
2. LOW: plano de 3–5 linhas na resposta, sem subagente e sem arquivo.
3. MEDIUM: codebase-explorer → docs/tarefas/<id>/impacto.md; você escreve plano.md curto (passos, testes, equipe).
4. HIGH: product-owner → historia.md [PARE para ok do dono] → codebase-explorer → impacto.md →
   architect → plano.md; tech-lead revisa o plano; business-analyst só se a regra de negócio estiver obscura.
5. Termine com: nível, equipe escolhida (e quem ficou de fora e por quê), arquivos prováveis, testes
   (comandos do Verify do CLAUDE.md), riscos, gates aplicáveis (docs/factory/QUALITY_GATES.md). Até 15 linhas.
Para executar depois: /factory-implement <id>.
