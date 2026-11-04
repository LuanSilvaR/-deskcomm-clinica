# Problemas recorrentes

Registre aqui só o que se repetiu ao menos uma vez, com o sintoma exato e a correção medida.

| Sintoma | Causa | O que fazer |
|---|---|---|
| Skill nova em `.claude/skills/` não aparece no `git status` | `.gitignore` só libera `deskcomm-*` e `sistema-vivo` ali | Skill do fork vai em `.claude/commands/` (é o que os `factory-*` fazem) |
| `skills-embutidas.test.ts` falha com "órfãs" | pasta rastreada em `.claude/skills/` sem fonte em `.agents/skills/` | Não crie skill ali; `.agents/skills` é dos guias do produto (e tem orçamento de caracteres do Codex) |
| `.claude/rules/*.md` não versiona | `.claude/*` é ignorado, com exceção de agents/commands/settings.json | Regras compartilhadas ficam no CLAUDE.md e em `docs/factory/` |
| Orquestrador "delega" mas nada acontece | rodou como subagente; subagente não chama subagente | `claude --agent factory-orchestrator`, ou /factory-plan e /factory-implement na sessão principal |
| Edit bloqueado com "ÁREA SENSÍVEL DO CORE" | hook `proteger.sh` | Peça aprovação explícita ao dono e registre em UPSTREAM.md |
| Unit falha num teste de IA localmente | `.env` local vaza chave para o teste | Compare com checkout limpo de origin/develop sem `.env` (CLAUDE.md, Verify) |
| `pnpm cercas` passa local mas CI reprova | no Windows o filtro de arquivo não funciona | A prova é o job `verify-parte (3)` (`gh pr checks <n>`) |
| `supabase db reset` sobe banco quebrado | a cadeia `migrations/` não sobe do zero | Use `pnpm test:db` (baseline + bootstrap) |
