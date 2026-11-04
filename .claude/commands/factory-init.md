---
description: Atualiza o conhecimento da fábrica sobre o projeto (docs/factory/PROJECT_CONTEXT.md e ARCHITECTURE.md). Não toca código.
disable-model-invocation: true
---
Escopo: $ARGUMENTS (vazio = revisão geral).
Atualize SÓ docs/factory/PROJECT_CONTEXT.md e docs/factory/ARCHITECTURE.md, e só onde o repo divergiu deles.
Meça antes de escrever: `git log --oneline -15 origin/develop`, `ls lib/clinic app/app`, package.json (versões),
`ls supabase/migrations | grep -oE "_9[0-9]{3}_" | sort | tail -1`, docs/current-state.md (cabeçalho).
Não leia o repositório inteiro; não copie conteúdo de ARCHITECTURE.md/AGENTS.md da raiz — referencie.
Não recrie a aplicação, não altere código, banco ou configuração. Resumo: o que mudou, em até 8 linhas.
