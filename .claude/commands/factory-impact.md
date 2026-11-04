---
description: Avalia impacto e risco de regressão de uma mudança (dependentes, contratos, testes a rodar) e sugere o nível. Somente leitura. Uso: /factory-impact <id> <mudança>
argument-hint: <id> <mudança>
disable-model-invocation: true
---
Mudança: $ARGUMENTS
Use o subagente codebase-explorer (é o analisador de impacto da fábrica; /impacto é a versão sem estrutura),
salvando em docs/tarefas/<id>/impacto.md. Peça a ele, além dos 5 pontos que já entrega:
- dependentes diretos do que muda (quem importa/chama: Grep pelo símbolo e pela rota);
- contratos públicos atingidos (rota /api/v1, coluna, prop, export usado fora do módulo) → expand/contract?
- testes que cobrem a área e os que precisam rodar (comando exato);
- nível sugerido LOW/MEDIUM/HIGH pela régua de docs/factory/WORKFLOWS.md.
Não altere nada. Resumo em até 10 linhas, com o caminho do impacto.md.
