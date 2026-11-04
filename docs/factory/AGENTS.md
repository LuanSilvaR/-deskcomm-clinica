# Os 20 papéis da fábrica e quem os cumpre

O projeto já tinha 21 agentes em `.claude/agents/`, chamados por nome no `/tarefa`, `/verificar`, na triagem
e no gov-loop. Renomeá-los quebraria esses fluxos e duplicá-los deixaria o Claude com dois candidatos por
delegação. Por isso, 12 papéis são cumpridos por agentes **existentes**; 8 foram **criados** para esta fábrica.

| # | Papel | Agente | Origem | Modelo | Escreve? |
|---|---|---|---|---|---|
| 01 | factory-orchestrator | `factory-orchestrator` | novo | opus | sim (como sessão principal) |
| 02 | product-owner | `product-owner` | existente | sonnet | só docs/tarefas |
| 03 | business-analyst | `business-analyst` | novo | sonnet | só docs/tarefas |
| 04 | scrum-master | `scrum-master` | novo | haiku | não (lê quadro/issues) |
| 05 | software-architect | `architect` | existente | opus | só plano.md / ADR |
| 06 | tech-lead | `tech-lead` | novo | opus | não |
| 07 | ux-ui-designer | `ux-accessibility` | existente | sonnet | não |
| 08 | frontend-developer | `frontend` | existente | sonnet | sim |
| 09 | backend-developer | `backend` | existente | sonnet | sim |
| 10 | fullstack-developer | `fullstack-developer` | novo | sonnet | sim |
| 11 | outsystems-specialist | `outsystems-specialist` | novo | sonnet | não (consultor; repo não usa OutSystems) |
| 12 | database-specialist | `migration-guardian` | existente | sonnet | sim (migrations) |
| 13 | integration-specialist | `integration` | existente | sonnet | sim |
| 14 | security-engineer | `security-lgpd` (+ `health-compliance`) | existente | opus / sonnet | não |
| 15 | qa-engineer | `regression-guardian` | existente | haiku | não |
| 16 | test-automation-engineer | `qa-automation` | existente | sonnet | sim (testes) |
| 17 | code-reviewer | `code-reviewer` | existente | sonnet | não |
| 18 | devops-engineer | `devops-engineer` | novo | sonnet | não (propõe) |
| 19 | technical-writer | `technical-writer` | novo | haiku | sim (docs) |
| 20 | release-manager | `release-manager` | existente | haiku | notas/checklist |

Agentes de análise (upgrade de 2026-11-04; acionamento seletivo em [EFFICIENCY.md](EFFICIENCY.md)):

| Papel | Agente | Origem | Modelo | Escreve? |
|---|---|---|---|---|
| exploração direcionada | `codebase-explorer` | existente | haiku | não |
| análise de impacto | `codebase-explorer` + roteiro do `/factory-impact` | existente | haiku | não (impacto.md via sessão) |
| causa raiz | `root-cause-analyzer` | novo | sonnet | não |
| escopo do diff | `change-scope-guardian` | novo | haiku | não |

Outros de apoio: `debugger` (corrige falhas; recebe a causa do root-cause-analyzer), `upstream-sync`,
`triagem-*` (triagem de PR), `gov-*` (gov-loop).

"Escreve? não" = sem `Edit`/`Write` no frontmatter. Quem tem `Bash` ainda pode escrever pelo shell — o que
impede é a instrução do agente e as permissões do `.claude/settings.json`, não o frontmatter (ver SECURITY.md).

## Critérios de delegação

| Sinal na demanda | Chame | Não chame |
|---|---|---|
| Ajuste localizado, texto, consulta | ninguém (sessão principal) | qualquer subagente |
| "Onde/como está X?" | `codebase-explorer` | architect |
| Regra de negócio ambígua | `business-analyst` | — |
| História e critérios para épico | `product-owner` | business-analyst junto, se a regra já está clara |
| Tabela, coluna, RLS, função SQL | `migration-guardian` (+ `architect` se schema novo) | backend para SQL |
| Rota `/api/v1`, worker, regra | `backend` | fullstack |
| Tela | `frontend` (+ `ux-accessibility` na revisão) | — |
| Rota + tela pequenas e acopladas | `fullstack-developer` | backend + frontend juntos |
| Pagamento, NFS-e, WhatsApp, e-mail | `integration` (+ `security-lgpd`) | — |
| CI vermelho por infra, Docker, deploy | `devops-engineer` | debugger |
| Teste/build quebrou durante a implementação | `debugger` | root-cause-analyzer |
| Bug de causa desconhecida, de tela ou produção | `root-cause-analyzer` → `debugger` corrige | debugger direto |
| Diff cresceu além do plano / toca core ou migration | `change-scope-guardian` | code-reviewer para isso |
| Prontuário, consentimento, fotos, insumos | `health-compliance` | — |
| Planos de especialistas em conflito | `tech-lead` | — |
| Algo de OutSystems | `outsystems-specialist` | — |

## Contrato de resposta

Agentes novos respondem no formato de [templates/contrato-agente.md](templates/contrato-agente.md).
Os existentes respondem em resumo curto e salvam em `docs/tarefas/<id>/`; o orquestrador normaliza no
contrato ao consolidar. Não há mensagens entre agentes: a sessão principal delega e recebe.
