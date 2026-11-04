# Contrato de resposta dos agentes

```
TASK_ID:       <id da pasta docs/tarefas/<id>/ ou da issue>
AGENT:         <nome do agente>
STATUS:        SUCCESS | PARTIAL | BLOCKED | FAILED
SUMMARY:       <1–3 linhas>
FILES_CHANGED: <caminhos, ou "nenhum">
DECISIONS:     <decisão + motivo em 1 linha cada>
VALIDATIONS:   <comando → exit code (+ resumo)>, ou "não executado"
RISKS:         <risco + mitigação>
BLOCKERS:      <o que impede, e quem destrava>
NEXT_ACTIONS:  <próximo passo e quem faz>
```

Regras:
- SUCCESS só com VALIDATIONS executadas e exit 0. Sem execução = PARTIAL, dizendo o que não foi medido.
- Separe sempre: implementado · testado · revisado · aprovado pelo dono · pendente.
- Campo vazio = escreva "nenhum"; não omita. LOW pode usar só STATUS, SUMMARY e VALIDATIONS.
