---
description: Diagnóstico estruturado de bug — sintoma, reprodução, causa com evidência, correção sugerida — antes de corrigir. Uso: /factory-debug <id> <sintoma>
argument-hint: <id> <sintoma>
disable-model-invocation: true
---
Sintoma: $ARGUMENTS
1. Trivial (mensagem de erro aponta a linha, ou typo/condição óbvia): diagnostique você mesmo, sem subagente.
2. Não trivial (causa desconhecida, intermitente, tela/produção, envolve banco ou fila): root-cause-analyzer
   com o sintoma exato e a evidência (evidence/, log, teste). Ele não corrige.
3. Com a causa provada, PARE e mostre: causa (arquivo:linha), evidência, correção mínima, teste que prova, nível.
4. Só com ok do dono: correção via /factory-implement <id> <nível> — o debugger corrige com teste que falha antes
   e passa depois. Mesmo bug pela 2ª vez = critérios errados (regra do /tarefa).
Sem dados reais de paciente na reprodução.
