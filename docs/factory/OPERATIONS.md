# Operação da fábrica

## Comandos

| Comando | Faz | Modo |
|---|---|---|
| `/factory-plan <id> <demanda>` | classifica, escolhe equipe, escreve plano | PLAN |
| `/factory-implement <id> [nível]` | executa pelo fluxo do /tarefa com as regras da fábrica | IMPLEMENT |
| `/factory-review [alvo]` | revisão independente, revisores escolhidos pelo diff | REVIEW |
| `/factory-test [escopo]` | testes proporcionais + tabela de exit codes | — |
| `/factory-security [alvo]` | segurança/LGPD proporcional ao risco | REVIEW |
| `/factory-document [id]` | docs afetados (technical-writer) | — |
| `/factory-release [versão]` | checklist, notas, reversão — não publica | — |
| `/factory-status [id]` | quadro, PRs, CI, bloqueios (scrum-master) | leitura |
| `/factory-refactor <id> <alvo>` | refatoração com testes de caracterização | HIGH |
| `/factory-init` | atualiza PROJECT_CONTEXT/ARCHITECTURE daqui | docs |
| `/factory-context <assunto>` | contexto mínimo (arquivos:linha, regra a reusar) | leitura |
| `/factory-impact <id> [profundo] <mudança>` | dependentes, contratos, testes a rodar, nível (`profundo` = impact-analyzer) | leitura |
| `/factory-debug <id> <sintoma>` | causa raiz com evidência antes de corrigir | leitura → IMPLEMENT com ok |
| `/factory-diff [id]` | escopo e preservação do diff antes do commit | REVIEW |
| `/factory-optimize [cenário]` | mede custo/eficiência da fábrica com sessões reais | leitura (custa tokens) |

Os anteriores continuam valendo: `/tarefa` (o fluxo em si), `/verificar`, `/impacto`, `/docs`, `/triagem-de-pr`.
Todos os `factory-*` têm `disable-model-invocation: true`: só rodam quando você digita. Isso tira as
descrições da lista que o Claude lê em toda sessão e evita disparo acidental de fluxo pesado.

## Orquestrador como sessão principal

Subagente não chama subagente. Para o orquestrador delegar, ele precisa ser a sessão:

```bash
claude --agent factory-orchestrator
```

Chamado como subagente (pela ferramenta Agent), ele só devolve o plano com a equipe.

## Exemplos neste projeto

| Situação | Comando |
|---|---|
| Planejar funcionalidade | `/factory-plan agenda-s2 lista de espera por profissional na agenda` |
| Implementar funcionalidade | `/factory-implement agenda-s2 HIGH` (após aprovar historia.md e plano.md) |
| Corrigir bug | `/factory-implement fix-confirmacao LOW` — ou só descreva o bug: LOW não precisa de comando |
| Revisar código | `/factory-review` (diff atual) · `/factory-review lib/clinic/estoque` |
| Refatorar módulo | `/factory-refactor estoque-saldo lib/clinic/estoque` |
| Executar testes | `/factory-test` · `/factory-test supabase` |
| Avaliar segurança | `/factory-security app/api/v1/clinic` |
| Preparar release | `/factory-release 1.4.0` |
| Ver andamento | `/factory-status 63` (épico Agenda por profissional) |

| Investigar bug | `/factory-debug fix-historico na agenda, agendamento passado não oferece ação` |
| Conferir escopo antes do commit | `/factory-diff agenda-s2` |

## Economia de tokens

Modelos, contexto, ferramentas e a medição real estão em [EFFICIENCY.md](EFFICIENCY.md).
