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
| lib/contacts/cpf.ts, app/api/v1/contacts/_handler.ts, app/api/v1/contacts/import/route.ts | Conserto da cifragem de CPF (par hash + cifra; encrypt_cpf/decrypt_cpf criados na 9002) — candidato a PR no upstream | 0d9522e9b |
| tests/unit/rpc-do-codigo-nasce-no-schema.test.ts | encrypt_cpf/decrypt_cpf saem da allowlist de RPCs congeladas | ff7f769e9 |
| tests/unit/credencial-de-enfeite-nao-derruba-a-leitura.test.ts | decrypt_cpf reconhecida como segunda cifra com as mesmas três guardas (teste 1b) | 240cb2694 |
| tests/invariants/lgpd-cascata-alcanca-quem-guarda-pessoa.test.ts | clinic_patient_profiles declarada: coberta pelo trigger de anonimização, com prova de efeito | 240cb2694 |
| components/agenda/DetalheDoCompromisso.tsx (de novo), app/app/contacts/[id]/_client.tsx (de novo), lib/navigation/catalogo.ts (de novo) | Status da visita no detalhe, histórico na aba Timeline, porta da Recepção | 9f79d5292 |
| app/api/v1/agenda/vinculos/route.ts, components/agenda/VinculoDaMarcacao.tsx | Busca do paciente ao marcar por nome, telefone, CPF (hash) ou nascimento, com fim do telefone e nascimento para homônimos | 0d7091ae7 |
| lib/navigation/catalogo.ts (de novo), app/app/agenda/_client.tsx (de novo) | Recepção sai do menu lateral (teto de 15 itens) e ganha o botão "Painel da recepção" no cabeçalho da Agenda | 50974e6fe |
| app/app/agenda/_client.tsx (de novo) | Passa onEscolherHorario à EscolhaDoProfissional: o próximo livre escolhe profissional e horário (E1.3) | 542e352e9 |
| app/app/agenda/_client.tsx (de novo), lib/navigation/catalogo.ts (de novo), lib/i18n/dicionario.ts (de novo), .github/workflows/e2e.yml (de novo) | Botão e porta do "Dia por profissional" (E1.4); espanhol; spec clinic-dia-por-profissional e clinic-proximo-livre | 5858ce47a |
| tests/unit/agenda-spec-nao-escolhe-o-periodo-sozinha.test.ts | Dispensa declarada para clinic-proximo-livre.spec.ts (não escolhe dia da grade) | d35f3bf28 |
| lib/agenda/consulta.ts | horariosLivresDaOrg soma aos ocupados os intervalos sem sala/equipamento (9007, atrás da opção) | 92889c650 |
| app/api/v1/agenda/agendamentos/_handler.ts (de novo), tests/unit/pessoa-marca-fora-da-grade.test.ts (de novo) | 23P01 da alocação de recurso diz "não há sala ou equipamento livre" | 92889c650 |
| lib/audit/actions.ts (de novo), lib/i18n/dicionario.ts (de novo), .github/workflows/e2e.yml (de novo) | Ações clinic.recurso_salvo e clinic.tipo_recursos_atualizados; espanhol; spec clinic-salas-e-equipamentos | 92889c650 |
| app/api/v1/agenda/agendamentos/_handler.ts (de novo), lib/api/errors.ts (de novo), lib/mcp/tools/agendamento.ts (de novo), tests/unit/pessoa-marca-fora-da-grade.test.ts (de novo) | Prazo do paciente (9008): o agente de IA não cancela nem remarca dentro do prazo (agenda_fora_do_prazo, com ensino da IA) | e20479afe |
| lib/navigation/catalogo.ts (de novo), lib/i18n/dicionario.ts (de novo), .github/workflows/e2e.yml (de novo) | Porta dos Indicadores da agenda (Análise › Os números do período, gerente+); espanhol; spec clinic-indicadores | 500ae13a5, 329934af3 |
| lib/api/errors.ts (de novo) | Código forbidden_permission (controle de acesso por permissões, ACL) | 0e27da704 |
| lib/navigation/{catalogo,interface,registry}.ts, lib/auth/types.ts, components/shell/{Sidebar,CommandPalette,NavHub}.tsx, app/app/layout.tsx, app/app/{ai,analise,crm,settings}/page.tsx | Menu, hubs e ⌘K filtram por permissão com o modo por permissões ligado (parâmetro opcional; desligado = igual ao upstream); `permissao` nas portas; porta de Papéis de acesso | bb210c504 |
| supabase/migrations 9013 (fork) sobre financial_entries, loyalty_ledger, financial_accounts, payment_methods | Policies RESTRITIVAS acesso_* (fn_has_permission) somadas às do upstream, sem reescrever nenhuma; desligado = mesmo nível de antes | (este PR) |
| app/app/team/invite/page.tsx, app/app/team/invite/_components/InviteForm.tsx | `?email=` pré-preenche o convite (atalho "Convidar" da busca em Papéis de acesso › Membros); prop opcional, sem ela igual ao upstream | (este PR) |
| app/app/agenda/page.tsx, app/app/agenda/_client.tsx (de novo) | Agenda: barra de filtros da clínica (especialidade, status, período, paciente, só horários livres; estado na URL), provedor da informação da clínica e, na visão Dia, o modo "Lista por profissional" | (este PR) |
| components/agenda/GradeDaAgenda.tsx, components/agenda/HistoricoDaAgenda.tsx | Bloco da grade com ícone do status da visita e "paciente · tipo"; linha do histórico com selo do status, confirmação e faltas — via contexto da clínica (sem provedor = igual ao upstream) | (este PR) |
| app/api/v1/agenda/vinculos/route.ts (de novo) | A busca de paciente usa `filtrarContatosPelaBusca` (lib/clinic/pacientes/busca-no-banco.ts); comportamento igual | (este PR) |
| lib/ui/icons.ts | Ícones DoorOpen, Stethoscope, UserMinus, XCircle (selos de status) | (este PR) |
| lib/i18n/dicionario.ts (de novo), .github/workflows/e2e.yml (de novo) | Espanhol das melhorias da Agenda; spec clinic-agenda-melhorias | (este PR) |
| lib/i18n/dicionario.ts (de novo) | Procedimentos e POP (9015): espanhol dos módulos e permissões novos | (este PR) |
| lib/navigation/catalogo.ts (de novo), lib/audit/actions.ts (de novo), lib/i18n/dicionario.ts (de novo), .github/workflows/e2e.yml (de novo) | Procedimentos (9015): porta /app/procedimentos (hub Atendimento, sem sidebar), ações clinic.procedimento_*/pop_*, espanhol, spec clinic-procedimentos | (este PR) |
| app/api/v1/team/[user_id]/_shared.ts | Com o modo por permissões ligado, trocar o papel legado responde 409 apontando para Papéis de acesso | bb210c504 |
| lib/audit/actions.ts (de novo), lib/i18n/dicionario.ts (de novo), .github/workflows/e2e.yml (de novo) | Ações acesso.*; espanhol do catálogo de permissões e da tela; spec clinic-papeis-de-acesso | bb210c504 |
| app/api/v1/agenda/vinculos/route.ts (de novo), lib/navigation/catalogo.ts (de novo), lib/i18n/dicionario.ts (de novo), .github/workflows/e2e.yml (de novo) | "faltou N×" na busca ao marcar; porta da tela Faltas; espanhol; spec clinic-faltas-e-prazo | e20479afe, 4d2f0f26f |
| app/api/v1/cron/agenda-reminder/route.ts | Lembrete de 12 h ou mais pede SIM/NÃO e registra o pedido quando `clinic.confirmacao_automatica` está ligada | 4170bf147 |
| app/api/v1/cron/agenda-reminder/route.ts (de novo) | Guarda o id da mensagem do lembrete no pedido de confirmação (9006) | 177b9d733 |
| lib/event-log/register-handlers.ts | Consumidor clinic-confirmacao-resposta.v1 de message.received | 4170bf147 |
| docker/scheduler/entrypoint.sh | Cron clinic-confirmacao-sem-resposta a cada 15 min | 4170bf147 |
| tests/shell/colisao-de-migration.test.sh | Teste hermético: não herda o GITHUB_REF do runner (reprovava em PR de número 7) — candidato a PR no upstream | 520ab0564 |
| app/api/v1/agenda/agendamentos/_handler.ts (de novo) | 23P01 da trava de sobreposição (9005) vira o mesmo 422 agenda_horario_indisponivel ao marcar e ao remarcar | 15fcc4dc9 |
| tests/unit/pessoa-marca-fora-da-grade.test.ts | Dois casos do fork: o 23P01 do banco sai como a mesma recusa | 15fcc4dc9 |
| lib/i18n/dicionario.ts (de novo), .github/workflows/e2e.yml (de novo) | Espanhol da trava; spec clinic-trava-de-sobreposicao | 15fcc4dc9 |
| lib/audit/actions.ts (de novo), lib/i18n/dicionario.ts (de novo), .github/workflows/e2e.yml (de novo) | Ação clinic.confirmacao_sem_resposta, espanhol da confirmação, spec clinic-confirmacao-de-consulta | 4170bf147 |
| app/api/v1/agenda/agendamentos/_handler.ts (de novo) | Compareceu recusa ficha incompleta (flag clinic.ficha_obrigatoria) | ff7f769e9 |
| app/app/contacts/**, components/contacts/*, components/inbox/CRMSidePanel.tsx, components/inbox/ConversationHeader.tsx, lib/ai/inbox-destino.ts | Textos "Contato" → "Paciente" (só texto de tela) | 6ac024745 |
| components/contacts/ContactsTable.tsx, app/app/contacts/[id]/_client.tsx, components/agenda/DetalheDoCompromisso.tsx | Selo da ficha, aba Ficha do paciente, botão Paciente chegou | f9fe73593 |
| tests/e2e/* (vários), tests/sonda-inbox-cabe-na-tela.ts, tests/unit/rotulo-tags-do-contato.test.tsx, tests/unit/inbox-header-nao-trava.test.tsx | Seletores acompanham o renome para Paciente | 6ac024745 |

## Skills de terceiros
As skills `supabase` e `supabase-postgres-best-practices` (supabase/agent-skills) ficam no perfil do usuário
(`~/.claude/skills`), NÃO no repositório: `.agents/skills` é reservado aos guias do produto e
`tests/unit/skills-embutidas.test.ts` reprova skill fora desse padrão (removidas em cb03beac1).
Reinstalar numa máquina nova: `npx skills add supabase/agent-skills -g`.
