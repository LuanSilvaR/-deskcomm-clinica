---
description: Avalia impacto e risco de regressão de uma mudança (dependentes, contratos, testes a rodar) e sugere o nível. Somente leitura. Uso: /factory-impact <id> <mudança>
argument-hint: <id> [profundo] <mudança>
disable-model-invocation: true
---
Mudança: $ARGUMENTS
Use UM analisador (medição de 2026-11-04 em docs/factory/reports/2026-11-04-medicao.md):
- padrão → codebase-explorer (é o que /impacto e /tarefa M usam), pedindo também dependentes diretos,
  contratos atingidos, testes a rodar (comando exato) e nível sugerido;
- impact-analyzer só se os argumentos trazem "profundo", ou para APROFUNDAR um docs/tarefas/<id>/impacto.md
  existente que deixou contratos/dependentes em aberto — passe-o a ele; nunca refaça do zero com os dois.
Nível final é seu, pela régua de docs/factory/WORKFLOWS.md: tocou core, auth, banco, RLS ou MCP ⇒ HIGH,
mesmo que o analisador sugira menos.
docs/tarefas/<id>/impacto.md já cobre a mudança e nada mudou desde então → só resuma, sem subagente.
Salve o resultado em docs/tarefas/<id>/impacto.md (a sessão salva; os analisadores não têm Write).
Não altere código. Resumo em até 10 linhas, com o caminho do impacto.md.
