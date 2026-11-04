# Instalação da fábrica — 2026-11-04

Branch `feature/fabrica-agentes` (de `origin/develop` @ a4a9a5b44). Claude Code 2.1.318.

## O que já existia e foi preservado

21 agentes em `.claude/agents/`, fluxo `/tarefa` P/M/G, `/verificar`, `/impacto`, `/docs`, triagem, gov-loop,
hooks `proteger.sh` (PreToolUse) e `lint.sh` (PostToolUse), `permissions.deny` no settings. Nenhum foi alterado.

## Decisões de integração

| Pedido do prompt | O que foi feito | Por quê |
|---|---|---|
| 20 agentes com nomes fixos | 12 papéis → agentes existentes; 8 criados | renomear quebra /tarefa, triagem e gov-loop; duplicar dá dois candidatos por delegação |
| skills em `.claude/skills/factory-*` | em `.claude/commands/factory-*.md` | `.claude/skills/*` é ignorado no git e `skills-embutidas.test.ts` reprova pasta rastreada sem fonte em `.agents/skills` (reservada aos guias do produto) |
| `.claude/rules/*.md` | não criado | `.claude/*` é ignorado no git; as regras já estão no CLAUDE.md (fonte única) e carregá-las de novo gastaria contexto em toda sessão |
| `docs/factory/tasks/` e `adr/` | referências para issues + `docs/tarefas/` e `docs/adr/` | o projeto já tem os dois; pasta paralela duplicaria |
| hooks novos | nenhum | os existentes já cobrem arquivos sensíveis e lint por arquivo |
| orquestrador que delega | `claude --agent factory-orchestrator` ou comandos na sessão principal | subagente não chama subagente no Claude Code |

## Validação executada

| Teste | Comando / método | Resultado |
|---|---|---|
| Frontmatter, nomes, modelos e tools dos 29 agentes; 10 comandos | script node no scratchpad | OK, 0 erros; 20/20 papéis com agente |
| Referências e links de `docs/factory/` | mesmo script (25 links) | OK após criar `reports/` |
| Espelho de skills intacto | `pnpm exec vitest run tests/unit/skills-embutidas.test.ts` | exit 0, 75/75 |
| C — operações sensíveis | `proteger.sh` com 8 caminhos | 6 sensíveis → exit 2; 2 legítimos → exit 0 |
| B — revisão somente leitura | `code-reviewer` em `lib/clinic/flags.ts`, hash da árvore antes/depois | APROVADO com ressalvas menores; hash idêntico |
| A — planejamento | `claude -p --agent factory-orchestrator --permission-mode plan`, demanda fictícia | HIGH (dinheiro + schema), equipe mínima justificada, achou `payment_methods` existente para reuso |
| D — contexto | leituras declaradas no Teste A | 2 arquivos de docs/factory + 3 buscas, nenhum arquivo de código aberto inteiro |
| Código da aplicação intacto | `git status --porcelain` | só `.claude/agents`, `.claude/commands`, `docs/factory`, `CLAUDE.md` (+1 linha) |

Não executado: lint/typecheck/test:unit completos (nenhum `.ts` foi tocado), `pnpm cercas` (no Windows a prova
é o job `verify-parte (3)` do CI — conferir no PR).

## Limites conhecidos

- Agente com `Bash` pode escrever pelo shell; "somente leitura" do code-reviewer é instrução + conferência de diff.
- Agentes novos só aparecem em sessão iniciada depois da criação dos arquivos.
- Agentes existentes não seguem o contrato de resposta; o orquestrador normaliza ao consolidar.
