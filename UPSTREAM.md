# Controle do fork
Base DeskcommCRM: v1.42.0 (commit 09d4da341) — data: 2026-09-22

## Arquivos do core alterados por nós
| Arquivo | Motivo | Commit |
|---|---|---|
| docker-compose.yml | WAHA para desenvolvimento local | a9fb36837 |
| package.json | dependência sass | a9fb36837 |
| pnpm-lock.yaml | lockfile acompanhando o package.json | a9fb36837 |
| CLAUDE.md | Substituído por versão curta do fork (economia de tokens); `merge=ours` no .gitattributes — doutrina completa segue em AGENTS.md | f1ea6ad21 |
| .gitattributes | `CLAUDE.md merge=ours` (requer `git config merge.ours.driver true` em cada clone) | f1ea6ad21 |
| .claude/settings.json | Permissões + hooks PreToolUse/PostToolUse do fork; SessionStart do upstream mantido | f1ea6ad21 |

## Skills de terceiros
As skills `supabase` e `supabase-postgres-best-practices` (supabase/agent-skills) ficam no perfil do usuário
(`~/.claude/skills`), NÃO no repositório: `.agents/skills` é reservado aos guias do produto e
`tests/unit/skills-embutidas.test.ts` reprova skill fora desse padrão (removidas em cb03beac1).
Reinstalar numa máquina nova: `npx skills add supabase/agent-skills -g`.
