---
description: Roda os testes proporcionais ao impacto do diff e consolida a evidência (comando + exit code). Uso: /factory-test [escopo]
argument-hint: [escopo]
disable-model-invocation: true
---
Escopo: $ARGUMENTS (vazio = diff atual contra develop).
Escolha pelo que mudou (`git diff --stat develop`), conforme o ## Verify do CLAUDE.md:
- sempre: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`;
- supabase/ ou SQL: `pnpm test:db` (Docker ligado);
- app/ ou components/: spec Playwright da tela contra a 3001;
- só docs/.claude: lint dos .md não existe — confira links e frontmatter; não rode a suíte inteira.
Saída longa vai para arquivo no scratchpad e você filtra; o EXIT CODE é a autoridade.
Falha no unit só é "sem regressão" se o MESMO arquivo falha num checkout limpo de origin/develop (sem .env).
Lacuna de teste para critério de aceite → qa-automation escreve; regressão suspeita → regression-guardian.
Relatório: tabela comando | exit | resumo, e o que NÃO foi medido. Não declare verde sem exit 0.
