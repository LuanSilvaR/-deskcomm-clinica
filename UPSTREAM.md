# Controle do fork
Base DeskcommCRM: v1.42.0 (commit 09d4da341) — data: 2026-09-22

## Arquivos do core alterados por nós
| Arquivo | Motivo | Commit |
|---|---|---|
| docker-compose.yml | WAHA para desenvolvimento local | a9fb36837 |
| package.json | dependência sass | a9fb36837 |
| pnpm-lock.yaml | lockfile acompanhando o package.json | a9fb36837 |
| CLAUDE.md | Substituído por versão curta do fork (economia de tokens); `merge=ours` no .gitattributes — doutrina completa segue em AGENTS.md | (este commit) |
| .gitattributes | `CLAUDE.md merge=ours` (requer `git config merge.ours.driver true` em cada clone) | (este commit) |
| .claude/settings.json | Permissões + hooks PreToolUse/PostToolUse do fork; SessionStart do upstream mantido | (este commit) |

## Pendências conhecidas herdadas
- `tests/unit/skills-embutidas.test.ts`: 13 falhas pelas skills `supabase*` adicionadas em a9fb36837 (fora do padrão de skill embutida). Existe antes da configuração do Claude Code.
