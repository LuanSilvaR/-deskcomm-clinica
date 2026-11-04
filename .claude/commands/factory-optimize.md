---
description: Audita o consumo e a eficiência da fábrica com medição real (tokens, custo, turnos, tempo, agentes, leituras repetidas) e propõe ajustes. Uso: /factory-optimize [cenário]
argument-hint: [cenário — vazio = bateria padrão]
disable-model-invocation: true
---
Cenário: $ARGUMENTS. Método e bateria: docs/factory/EFFICIENCY.md §Medição. Último resultado: docs/factory/reports/.
1. Rode cada tarefa da bateria em sessão nova e somente leitura, com e sem o comando da fábrica:
   `claude -p --permission-mode plan --max-turns <n> --output-format stream-json --verbose "<prompt>" > <scratchpad>/<nome>.jsonl`
2. Meça do .jsonl: custo e tokens (evento result), turnos, duração, ferramentas por nome, subagentes, Read repetido
   do mesmo arquivo. Script de leitura: docs/factory/scripts/medir.mjs.
3. Compare com a medição anterior do reports/. Não estime: número sem medição não entra no relatório.
4. Regra de ajuste: otimização que custa mais sem melhorar o resultado → desligue o acionamento automático
   (ou rebaixe o modelo, nunca em segurança/arquitetura) e registre o porquê.
Saída: tabela por tarefa (A sem fábrica × B com fábrica) + recomendações + novo arquivo em docs/factory/reports/.
Custa tokens de verdade: confirme com o dono antes de rodar a bateria inteira.
