---
description: Planeja e executa refatoração preservando comportamento (testes de caracterização primeiro). Uso: /factory-refactor <id> <alvo>
argument-hint: <id> <alvo>
disable-model-invocation: true
---
Demanda: $ARGUMENTS. Refatoração é HIGH por padrão (docs/factory/WORKFLOWS.md); LOW só se for local a 1 arquivo
sem contrato público.
1. codebase-explorer → docs/tarefas/<id>/impacto.md: quem chama o alvo, contratos públicos (rotas, props,
   colunas, exports usados fora do módulo).
2. architect → plano.md em passos expand/contract, cada um verde por si só. tech-lead revisa. [PARE para ok do dono]
3. qa-automation escreve testes de CARACTERIZAÇÃO do comportamento atual; eles devem PASSAR antes da mudança.
4. Implementar passo a passo; após cada passo, os mesmos testes passam sem mudar asserção. Asserção mudou =
   comportamento mudou = não é refatoração: pare e avise.
5. regression-guardian → code-reviewer. Nada de renomear/remover coluna, rota ou prop em uso (regra 1 do CLAUDE.md).
Relatório no contrato de docs/factory/templates/contrato-agente.md.
