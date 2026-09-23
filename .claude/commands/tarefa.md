---
description: Executa uma tarefa pelo fluxo P, M ou G. Uso: /tarefa <P|M|G> <id> <descrição ou item do backlog>
---
Argumentos: $ARGUMENTS
Pasta de trabalho: docs/tarefas/<id>/ (crie). Todo agente salva o resultado nela e responde só um resumo curto.
Crie a branch feature/<id> a partir de develop atualizada (`git switch develop && git pull`), com árvore limpa.

Se P: implemente direto (Grep antes de Read) → regression-guardian → commit.
Se M: codebase-explorer (salvar impacto.md) → implemente com backend/frontend conforme a área →
      qa-automation → regression-guardian → code-reviewer → commit.
Se G, nesta ordem, PARANDO para minha aprovação nos itens marcados [PARE]:
 1. product-owner → historia.md (critérios Given/When/Then) [PARE]
 2. codebase-explorer → impacto.md
 3. architect → plano.md (passos pequenos, migrations, flag, testes) [PARE]
 4. migration-guardian → cria e revisa migrations (tripla: arquivo + MANIFEST + baseline), se houver
 5. qa-automation → testes dos critérios (devem falhar agora)
 6. backend e frontend → implementam até passar, seguindo plano.md
 7. regression-guardian
 8. security-lgpd
 9. code-reviewer
10. Commits em Conventional Commits. NÃO faça push. Resumo final em até 10 linhas.
