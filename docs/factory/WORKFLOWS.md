# Fluxos

Os três níveis da fábrica **são** os fluxos do [/tarefa](../../.claude/commands/tarefa.md):
LOW = P · MEDIUM = M · HIGH = G. Os passos detalhados vivem lá; aqui ficam a classificação e os modos.

## Classificação (pelo risco, não pelo número de arquivos)

| Nível | Quando | Equipe típica |
|---|---|---|
| **LOW** | bug localizado, texto, ajuste visual, consulta ao código; nada em banco/auth/core | nenhuma — sessão principal → `regression-guardian` opcional |
| **MEDIUM** | feature localizada, endpoint novo, mudança de regra, integração simples | 2–4: `codebase-explorer` → `backend`/`frontend`/`fullstack-developer` → `qa-automation` → `code-reviewer` |
| **HIGH** | schema/RLS, core, várias áreas, integração crítica, prontuário, refatoração estrutural | `product-owner` [PARE] → `codebase-explorer` → `architect` [PARE] → `tech-lead` → especialistas → `regression-guardian` → `security-lgpd` → `code-reviewer` |

Sobe de nível automaticamente: toca `supabase/`, `proxy.ts`, `lib/supabase|auth`, RLS, prontuário assinado,
dinheiro (financeiro/pagamento), dado pessoal exportado. Na dúvida, o nível mais alto.

## Modos

| Modo | Comando | Pode editar? | Permissão nativa sugerida |
|---|---|---|---|
| PLAN | `/factory-plan` | só `docs/tarefas/<id>/` | Plan mode (Shift+Tab) |
| IMPLEMENT | `/factory-implement`, `/tarefa` | sim, na `feature/<id>` | padrão (pede aprovação) |
| REVIEW | `/factory-review`, `/verificar` | não | Plan mode |

O modo é contrato de instrução; quem **impede** a edição é o modo de permissão do Claude Code e o
frontmatter `tools` dos agentes revisores. Não confunda os dois.

## Fluxo HIGH, ponta a ponta

```
demanda ─▶ /factory-plan <id>
           ├─ product-owner → historia.md ............ [PARE: dono aprova critérios]  Gate 1
           ├─ codebase-explorer → impacto.md
           └─ architect → plano.md ─ tech-lead revisa  [PARE: dono aprova plano]     Gate 2
        ─▶ /factory-implement <id> HIGH
           ├─ migration-guardian (tripla) ─ qa-automation (testes falhando)
           ├─ backend ∥ frontend (paralelo só sem arquivo em comum)                   Gate 3
           ├─ regression-guardian + Verify do CLAUDE.md ..........................   Gate 4
           ├─ security-lgpd (+ health-compliance) ..................................  Gate 5
           ├─ code-reviewer ─ (máx. 2 ciclos de correção)
           └─ technical-writer (se docs mudaram) ─ commit, SEM push
        ─▶ ok do dono ─▶ PR para develop (label status: dev) ─▶ /factory-release   Gate 6
```

## Limites

- **2 ciclos** automáticos de revisão↔correção por demanda. No 3º, pare e apresente os bloqueios.
- Corrigir o mesmo problema pela 2ª vez = os critérios estão errados: pare e reescreva-os (regra do /tarefa).
- Paralelo só com tarefas independentes, sem arquivo em comum; quem edita em paralelo usa worktree
  (`isolation: worktree`). Dependência = sequencial. Agent Teams não é requisito.
