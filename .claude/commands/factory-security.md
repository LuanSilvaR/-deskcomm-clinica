---
description: Avalia riscos de segurança e LGPD do diff ou de um módulo, proporcional ao risco. Somente leitura. Uso: /factory-security [alvo]
argument-hint: [alvo]
disable-model-invocation: true
---
Alvo: $ARGUMENTS (vazio = diff contra develop). Regras: docs/factory/SECURITY.md.
1. Triagem de risco pelo diff: sem auth/RLS/API/banco/upload/integração/dado pessoal → resposta curta
   "risco baixo, motivo", sem subagente.
2. Caso contrário: security-lgpd no diff; health-compliance se tocar prontuário, consentimento, fotos ou insumos.
   Dependências novas no package.json → `pnpm audit --prod` (só leitura) e cite os avisos altos/críticos.
3. Não edite. Achados com arquivo:linha, cenário de ataque em uma linha e correção sugerida; marque o que
   BLOQUEIA a entrega (Gate 5 de docs/factory/QUALITY_GATES.md). Não exponha segredo no relatório. Até 15 linhas.
