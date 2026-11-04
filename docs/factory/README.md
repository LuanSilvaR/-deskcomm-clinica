# Fábrica de agentes — ponto de entrada

A equipe virtual que planeja, implementa, testa, revisa e documenta demandas **deste** repositório
(SaaS de clínicas de estética, fork do DeskcommCRM). Ela não substitui o fluxo do projeto:
**é** o fluxo `/tarefa` P/M/G, com papéis nomeados e regras de seleção explícitas.

| Preciso de… | Vá para |
|---|---|
| Entender o sistema em 1 página | [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) · [ARCHITECTURE.md](ARCHITECTURE.md) |
| Saber qual agente faz o quê | [AGENTS.md](AGENTS.md) |
| Saber como uma demanda anda | [WORKFLOWS.md](WORKFLOWS.md) |
| Saber o que bloqueia uma entrega | [QUALITY_GATES.md](QUALITY_GATES.md) · [SECURITY.md](SECURITY.md) |
| Operar a fábrica no dia a dia | [OPERATIONS.md](OPERATIONS.md) · [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Formato de resposta dos agentes | [templates/contrato-agente.md](templates/contrato-agente.md) |
| Relatórios da fábrica | [reports/](reports/) |

## Onde ficam as coisas que o prompt da fábrica chamava de `tasks/` e `adr/`

Não criamos pastas paralelas — o projeto já tem as duas:

- **Demandas**: issues + quadro GitHub Projects ([docs/backlog.md](../backlog.md)) e a pasta de trabalho
  `docs/tarefas/<id>/` (`historia.md`, `impacto.md`, `plano.md`, `handoff.md`). Modelo: [templates/tarefa.md](templates/tarefa.md).
- **Decisões**: [docs/adr/](../adr/) (numeração `NNNN-titulo.md`).

## Precedência

`CLAUDE.md` (regras invioláveis do fork) > `AGENTS.md` da raiz (doutrina do upstream) > `docs/factory/*`.
Se um arquivo daqui discordar do CLAUDE.md, o CLAUDE.md vence e este arquivo deve ser corrigido.
