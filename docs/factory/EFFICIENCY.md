# Eficiência: modelos, contexto, ferramentas e medição

## Modelos

Os agentes usam **aliases** (`haiku`, `sonnet`, `opus`, `inherit`), que o Claude Code resolve para a versão
disponível na conta. Nunca fixe um ID de modelo no frontmatter: ele envelhece e pode não existir na conta.

| Faixa | Modelo | Agentes | Critério |
|---|---|---|---|
| Leitura mecânica | `haiku` | codebase-explorer, regression-guardian, change-scope-guardian, scrum-master, technical-writer, release-manager | segue roteiro fixo; erro é barato e visível |
| Implementação e diagnóstico | `sonnet` | backend, frontend, fullstack-developer, integration, migration-guardian, qa-automation, debugger, root-cause-analyzer, impact-analyzer, code-reviewer, ux-accessibility, health-compliance, product-owner, business-analyst, devops-engineer, outsystems-specialist | raciocínio local sobre código |
| Decisão crítica | `opus` | factory-orchestrator, architect, tech-lead, security-lgpd | erro é caro e silencioso — **não rebaixar para economizar** |
| Herdado | `inherit` | gov-*, triagem-* | o loop/triagem escolhe |

Rebaixar um agente só com medição mostrando a mesma qualidade (ver §Medição). Segurança e arquitetura ficam fora dessa regra.

## Contexto

1. **CLAUDE.md pequeno**: só regras invioláveis + ponteiros. Detalhe vive em `docs/factory/` e é lido sob demanda.
2. **Reuso**: arquivo já lido nesta conversa e não alterado desde então não é relido nem re-delegado.
3. **Grep antes de Read**; Read com `offset/limit` quando o arquivo passa de ~300 linhas.
   `supabase/baseline.sql` nunca inteiro: Grep pela função (a última definição é a que vale).
4. **Delegar para isolar, não por hábito**: subagente custa um contexto novo inteiro. Vale quando a busca abre
   muitas frentes (o resumo volta curto e o contexto principal fica limpo) ou quando o trabalho é paralelizável.
   Para 1–3 buscas, a sessão principal é mais barata.
5. **Passe recortes**: ao delegar, mande TASK_ID, objetivo, arquivos:linha e critérios — não "leia o projeto".
6. **Saídas longas para arquivo** (lint, testes) e filtre; o exit code é a autoridade.

## Acionamento seletivo dos agentes de análise

Nenhum é obrigatório; o orquestrador decide caso a caso.

| Agente | Acione quando | Não acione quando |
|---|---|---|
| `codebase-explorer` (exploração e impacto) | busca com mais de ~5 frentes; M/G antes de alterar; dependentes ou contrato público em jogo | a resposta está em 1–3 Greps; o contexto já está na conversa |
| `root-cause-analyzer` | causa desconhecida, intermitente, de tela/produção, ou correção que precisa de aprovação | erro aponta a linha; teste quebrou durante a implementação (→ `debugger`) |
| `change-scope-guardian` | diff passou do plano, toca core/migrations, ou há trabalho local não relacionado na árvore | diff só em docs/.claude; LOW de 1 arquivo |
| `impact-analyzer` | **sob pedido** (`/factory-impact <id> profundo …`) ou para aprofundar um `impacto.md` que deixou contratos/dependentes em aberto | por padrão — o acionamento automático foi retirado após medição (abaixo) |

Os dois analisadores não se sobrepõem: o `codebase-explorer` (haiku) localiza e faz o impacto; o
`impact-analyzer` (sonnet) só aprofunda dependências, contratos e testes. O `/factory-impact` usa um.
Por que não automático: na mesma troca de assinatura, rotear para ele custou US$ 0,46 contra 0,35 do
explorer e devolveu nível M onde a régua dá HIGH ([reports/2026-11-04-medicao.md](reports/2026-11-04-medicao.md), t6).

## Skills/comandos

Todos os `/factory-*` têm `disable-model-invocation: true`: só rodam quando digitados e não ocupam a lista
de skills de toda sessão. Nenhum agente pré-carrega skill (`skills:` no frontmatter não é usado). As skills
`deskcomm-*` e `sistema-vivo` são do upstream e ficam como estão.

## Ferramentas

- **LSP**: o marketplace oficial tem o plugin `typescript-lsp` (navegação por símbolo, referências, diagnósticos
  após cada edição). **Não instalado** — requer o plugin e o binário `typescript-language-server`
  (`npm i -g typescript-language-server typescript`). Ganho esperado: "quem chama X" sem Grep amplo.
  Instalação é decisão do dono; depois, rode `/factory-optimize` para medir se reduziu chamadas.
- **Lint/build/testes**: reutilizados (`pnpm lint|typecheck|test:unit|test:db`). Nenhum novo.
- **Hooks**: `proteger.sh` (bloqueio) e `lint.sh` (eslint só no arquivo editado) não chamam o modelo e são
  locais ao arquivo. Nenhum hook novo: rodar a suíte por edição custaria mais do que acharia.

## Medição

Bateria de 5 tarefas, cada uma em sessão nova, somente leitura (`--permission-mode plan`), em duas variantes:
**A** = prompt direto, sem a fábrica; **B** = o comando `/factory-*` correspondente.
Métricas de `--output-format stream-json`, extraídas por [scripts/medir.mjs](scripts/medir.mjs).
Resultado e recomendações: [reports/2026-11-04-medicao.md](reports/2026-11-04-medicao.md). Rodar de novo: `/factory-optimize`.

| # | Tarefa | A (direto) | B (fábrica) |
|---|---|---|---|
| t1 | correção simples (JSDoc em `lib/clinic/flags.ts`) | "Planeje a correção…" | `/factory-plan` |
| t2 | funcionalidade nova (forma de pagamento na presença) | "Planeje a implementação…" | `/factory-plan` |
| t3 | investigação de bug (histórico da agenda sem ação) | "Investigue a causa…" | `/factory-debug` |
| t4 | refatoração localizada (helper em `flags.ts`) | "Planeje a refatoração…" | `/factory-refactor` |
| t5 | revisão (`lib/clinic/estoque/posicao.ts`) | "Revise…" | `/factory-review` |
