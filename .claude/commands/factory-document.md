---
description: Atualiza a documentação afetada pela demanda, sem criar doc redundante. Uso: /factory-document [id]
argument-hint: [id]
disable-model-invocation: true
---
Demanda: $ARGUMENTS. Use o subagente technical-writer com o `git diff develop --stat` e a pasta
docs/tarefas/<id>/ (se houver). Mesmas regras do /docs: só o necessário, CHANGELOG.md não se edita, core
alterado → UPSTREAM.md. Regra ou arquitetura mudou → também docs/factory/ (PROJECT_CONTEXT ou ARCHITECTURE).
Resumo: arquivos tocados, até 6 linhas.
