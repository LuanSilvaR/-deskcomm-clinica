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
| supabase/baseline.sql | Apêndice da migration 9001 (clinic), ANTES da varredura anon (0116), que precisa ser o último bloco a criar função | e7a57e50e |
| supabase/migrations/MANIFEST.md | Linha da migration 9001 | e7a57e50e |
| lib/audit/actions.ts | Ações clinic.* no vocabulário de auditoria | 3a5ab22a4 |
| lib/i18n/dicionario.ts | Traduções em espanhol das mensagens e telas clinic | 3a5ab22a4 |
| tests/invariants/hardening-definer-varredura.test.ts | fn_clinic_definir_flag em AUTHENTICATED_PERMITIDO, com call site | 3a5ab22a4 |
| lib/agenda/consulta.ts | horariosLivresDaOrg: checagem de especialidade e bloqueios clinic como exceções (atrás da flag) | 4dce1ebcb |
| app/api/v1/agenda/agendamentos/_handler.ts | marcarAgendamentoHandler recusa profissional não habilitado; código novo no mapa de recusas | 4dce1ebcb |
| app/api/v1/agenda/horarios-livres/route.ts | Código profissional_nao_habilitado no mapa de status | 4dce1ebcb |
| lib/api/errors.ts | Código canônico profissional_nao_habilitado | 4dce1ebcb |
| lib/mcp/tools/agendamento.ts | Ensino da IA para profissional_nao_habilitado | 4dce1ebcb |
| lib/navigation/catalogo.ts | Porta da tela /app/settings/tenant/profissionais | bf4e0daa2 |
| app/app/team/_components/AttendantsClient.tsx | export de ScheduleDialog e Attendant para reuso na ficha do profissional | bf4e0daa2 |
| app/app/agenda/_client.tsx | EscolhaDoProfissional (atrás da flag) e owner_user_id na consulta e na marcação | b7d3f72db |
| .github/workflows/e2e.yml | Spec clinic-profissionais-e-bloqueios na SPECS_PARTE_2 | b9eb7fd0e |
| tests/invariants/rls-completude-varredura.test.ts | Tabelas clinic_* em PROVA_PROPRIA | 410cca27f |

## Skills de terceiros
As skills `supabase` e `supabase-postgres-best-practices` (supabase/agent-skills) ficam no perfil do usuário
(`~/.claude/skills`), NÃO no repositório: `.agents/skills` é reservado aos guias do produto e
`tests/unit/skills-embutidas.test.ts` reprova skill fora desse padrão (removidas em cb03beac1).
Reinstalar numa máquina nova: `npx skills add supabase/agent-skills -g`.
