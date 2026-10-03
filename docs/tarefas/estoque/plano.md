# Plano — Controle de Estoque integrado ao Prontuário (clínica de estética)

## Contexto
A clínica precisa saber o que entra, o que sai e o que sobra de cada produto, com rastreio por paciente,
profissional, procedimento, lote, validade e nota fiscal. A entrada deve ser rápida, por XML da NF-e.

Hoje:
- O estoque é um inteiro digitado à mão em `catalog_products.quantidade`.
- Não há movimentos, lotes, locais, fornecedores, NF-e nem prescrição.
- O prontuário já deixou a porta pronta:
  - os insumos são gravados com produto, quantidade, lote, validade e ANVISA (9022/9027);
  - finalizar emite o evento `clinic.procedimento_confirmado`;
  - o consumidor `lib/clinic/estoque/consumo.handler.ts` chama `portaDeEstoque()`, que hoje é `SemEstoque` e não faz nada.

Este plano liga essa porta a um estoque de verdade. A regra do repositório vale aqui: **estoque = soma de movimentos**.

### Decisões do dono (respondidas)
| Tema | Decisão |
|---|---|
| NF-e | Só **upload do XML** (sem DF-e/SEFAZ/certificado) |
| Baixa | **Ao finalizar o atendimento**, reaproveitando o evento existente; antes disso é reserva |
| Prescrição | **Kit padrão por procedimento** → reserva; no atendimento ajusta o realmente usado |
| Catálogo | **Estender `catalog_products`** (tabela 1:1 nova) e **sincronizar `quantidade`** com o saldo real |
| Controlados | **Profissional habilitado** (conselho permitido por produto) + alerta; sem SNGPC |
| NF-e → financeiro | Gera **conta a pagar pendente** em `financial_entries` (atrás de opção) |
| Frasco vencido | **Só alerta**, com botão "registrar perda" |
| IA | (1) IA sugere o de/para da NF-e; (2) a IA consulta o estoque; (3) **Groq** como provedor novo (DeepSeek e OpenRouter já existem) |

## Princípios
- Tudo atrás da flag `settings.clinic.estoque`, desligada por padrão.
- Código em `lib/clinic/estoque`, `app/api/v1/clinic/estoque`, `components/clinic/estoque` e tabelas `clinic_estoque_*`.
- Movimentos **só acrescentam** (trigger recusa UPDATE/DELETE, até para o service_role). Correção é sempre **estorno**.
- **Saldo negativo é proibido.** As funções que tiram saldo fazem `for update` nos lotes em ordem de id.
- **O prontuário manda.** Finalizar nunca falha por falta de estoque. A baixa roda logo depois (event_log) e,
  se faltar saldo ou lote, vira **pendência + alerta**.
- Quantidades ficam na **unidade de aplicação** (ex.: U, mL, un). O produto declara unidade de estoque e fator
  (ex.: frasco = 100 U).
- O núcleo só é tocado onde foi aprovado, e tudo vai para o UPSTREAM.md:
  - os triggers de sincronia em `catalog_products`;
  - a dependência `fast-xml-parser`;
  - o provedor Groq em `lib/ai/pontos/provedores.ts` + registry;
  - a ferramenta MCP de estoque.

## Modelo de dados
Todas as tabelas têm `organization_id` (cascade), RLS `tenant_isolation_*` via `fn_user_org_ids()` e FKs compostas por org.

- **`clinic_produto_estoque`** (1:1 com `catalog_products`):
  - identificação: `ean, ncm, registro_anvisa`;
  - unidades: `unidade_estoque, unidade_aplicacao, fator_conversao`;
  - fracionamento: `fracionavel, validade_pos_abertura_horas`;
  - controle: `rastreado` (exige lote), `controlado`, `conselhos_permitidos text[]`, `estoque_minimo, ponto_pedido`;
  - `gerenciado` (liga a sincronia).
- **`clinic_estoque_locais`**: central, sala, carrinho, farmácia ou outro. Pode apontar para `clinic_resources`. Um local é o padrão.
- **`clinic_estoque_lotes`**: produto, código (vazio = sem lote), validade, custo unitário, fornecedor e item de NF-e de origem.
- **`clinic_estoque_operacoes`** (cabeçalho):
  - campos: tipo, origem, motivo, ator, `estorna_operacao_id`;
  - tipos: entrada, consumo, transferência, perda, ajuste, inventário, abertura de frasco, estorno;
  - **único `(org, origem_tipo, origem_id)`** → idempotência da baixa por insumo.
- **`clinic_estoque_movimentos`** (linhas com sinal):
  - produto, lote, local, frasco e custo;
  - no consumo, guarda atendimento, paciente, profissional e procedimento, para os relatórios;
  - só acrescenta.
- **Saldo** = view `clinic_estoque_saldos` (`security_invoker`): soma por produto, lote, local e frasco.
  **Disponível** = saldo − reservas ativas.
- **`clinic_estoque_reservas`**: atendimento ou agendamento, produto, local, quantidade; status ativa, convertida, liberada ou expirada.
  Não é movimento.
- **`clinic_procedimento_kits`**: procedimento → produto e quantidade. Não altera `clinic_procedures`.
- **`clinic_estoque_frascos`**: frasco aberto (lote, local, aberto em, vence em). O conteúdo é a soma dos movimentos daquele frasco.
- **Compras:**
  - `clinic_estoque_fornecedores` (CNPJ único por org);
  - `clinic_estoque_fornecedor_produtos` (de/para aprendido);
  - `clinic_estoque_nfe` (**chave de 44 dígitos única por org**, status, XML no Storage privado, sha256);
  - `clinic_estoque_nfe_itens` (cProd, xProd, EAN, NCM, quantidade, valor, custo rateado, `rastro` com lote e validade,
    produto casado, origem do casamento `ean|historico|nome|ia|manual`, conferido).
- **`clinic_estoque_inventarios`** e `_itens` (saldo fotografado e contado).
- **`clinic_estoque_pendencias`**: consumo não baixado. Motivos: `sem_saldo`, `lote_desconhecido`, `sem_local`,
  `profissional_nao_habilitado`.
- **`clinic_estoque_alertas`**: tipo, referência, chave de dedupe e status.
- `clinic_procedimento_insumos.movimento_estoque_id` passa a guardar o **id da operação** (FEFO pode usar mais de um lote).

## Fases (1 PR por fase, branch `feature/estoque-eN` a partir de `develop`; migrations a partir de 9028)
| Fase | Migration | Entrega |
|---|---|---|
| **E0 Base** | 9028 `clinic_estoque_base` | Ver detalhes abaixo |
| **E1 Sincronia** | 9029 `clinic_estoque_sincronia_catalogo` | Ver detalhes abaixo |
| **E2 Baixa** | 9030 `clinic_estoque_consumo` | Ver detalhes abaixo |
| **E3 Kit e reserva** | 9031 `clinic_estoque_kits_reservas` | Ver detalhes abaixo |
| **E4 Fracionamento** | 9032 `clinic_estoque_fracionamento` | Ver detalhes abaixo |
| **E5 NF-e** | 9033 `clinic_estoque_compras_nfe` | Ver detalhes abaixo |
| **E6 Inventário** | 9034 `clinic_estoque_inventario` | Contagem por local; fechar gera ajuste das diferenças |
| **E7 Alertas** | 9035 `clinic_estoque_alertas` | Ver detalhes abaixo |
| **E8 Relatórios** | 9036 `clinic_estoque_relatorios` | Ver detalhes abaixo |
| **E9 IA** | — (ou 9037) | Ver detalhes abaixo |

**E0 — Base**
- Tabelas base, view de saldo, flag e `fn_clinic_definir_estoque`.
- Funções: entrada manual com lote, transferência, perda, ajuste e estorno.
- Permissões em `lib/clinic/acesso/catalogo.ts`:
  - não clínicas: `estoque.ver/movimentar/inventariar/compras/configurar/custos/estornar`;
  - clínicas: `estoque.rastreio_lote`, `estoque.relatorio_paciente`.
- Menu "Estoque" (`lib/navigation/catalogo.ts`, `lib/clinic/navegacao/modulos.ts`).
- Cartão Ligar/Desligar em Configurações › Profissionais.
- Telas: posição de estoque, ficha do produto (campos novos), locais, entrada, transferência.

**E1 — Sincronia**
- Trigger após movimento grava `catalog_products.quantidade = saldo/fator` dos produtos `gerenciado`.
- Trigger antes de UPDATE impede a planilha ou a tela de sobrescrever esses produtos.
- Com isso, a loja e a IA do WhatsApp passam a ver o saldo real. Registrar no UPSTREAM.

**E2 — Baixa**
- `EstoqueReal` substitui `SemEstoque` quando a flag está ligada.
- Para cada insumo, `fn_clinic_estoque_baixar_consumo` (service role, idempotente):
  - local = sala do agendamento, senão o local padrão;
  - vale o lote informado; sem lote, usa FEFO;
  - controlado exige conselho habilitado.
- O que faltar vira pendência + alerta. Tela de pendências com "resolver" (gera a saída).
- Atualizar o payload do evento com `registro_anvisa` e o profissional.

**E3 — Kit e reserva**
- Editor de kit no procedimento.
- Reserva ao iniciar o atendimento: trigger SQL; o kit vem da sessão do plano ou do procedimento escolhido.
- Reserva D-1 dos agendamentos ligados a sessão de plano: cron `estoque-reservas`.
- Anular o atendimento libera as reservas; finalizar converte.
- A tela de procedimentos do atendimento ganha:
  - insumos pré-preenchidos pelo kit;
  - **saldo disponível, lote FEFO sugerido e validade**, em campos aditivos de `GET /clinic/procedimentos/opcoes`.

**E4 — Fracionamento**
- Abrir frasco pela tela do atendimento ou do estoque (toxina: frasco → U).
- A FEFO prefere frasco aberto dentro do prazo.
- Encerrar frasco com sobra → perda.
- Frasco vencido → alerta com "registrar perda".

**E5 — NF-e**
- Upload do XML: copia o padrão de `app/api/v1/clinic/pacientes/[contactId]/anexos/route.ts`:
  - multipart, até 1 MB, conferência dos bytes, sha256;
  - bucket privado `clinic-nfe`, desfazer se falhar.
- Parser `lib/clinic/estoque/nfe/parser.ts` com `fast-xml-parser`, sem DTD/entidades.
- Chave duplicada → 409 + alerta.
- O CNPJ do destinatário deve ser o da clínica (aviso se não for).
- De/para: EAN → histórico do fornecedor → nome → **sugestão por IA (E9)**.
- Tela de **conferência obrigatória**: item novo, fator de conversão, lote e validade (obrigatórios em produto rastreado).
- Lançar gera:
  - lotes e entrada;
  - custo com rateio de frete, seguro, IPI, ST e outros, menos desconto;
  - aprendizado do de/para;
  - `financial_entries` pendente (opção).

**E7 — Alertas**
- Cron diário `estoque-alertas`.
- Tipos: abaixo do mínimo ou do ponto de pedido; validade em 30/60/90 dias ou vencido; frasco vencido; pendências;
  controlado sem profissional habilitado; NF-e duplicada ou com divergência.
- Painel no módulo e tarefa (`crm_tasks`) opcional para o responsável.
- Não usa o kind do inbox, para não mexer no CHECK do núcleo.

**E8 — Relatórios**
- RPCs SQL no padrão de `app/api/v1/reports/financeiro`, gráficos com recharts.
- Relatórios:
  - posição;
  - consumo por procedimento, profissional e paciente;
  - perdas por vencimento;
  - **rastreio de lote** (recall: quais pacientes receberam o lote X);
  - custo por paciente e por procedimento;
  - sugestão de compra pelo ponto de pedido.

**E9 — IA**
- **Groq** como provedor:
  - entrada em `lib/ai/pontos/provedores.ts`, compatível com OpenAI, base `api.groq.com/openai/v1`;
  - registry e validador de chave;
  - teste `provedores-x-registry`.
- Ponto de IA novo `estoque_nfe_depara` (`lib/ai/pontos/registro.ts`):
  - escolhe o provedor e o modelo por clínica, inclusive Groq e DeepSeek;
  - sugere o produto para itens sem casamento, sempre como **sugestão** a conferir;
  - não envia dado de paciente.
- Ferramenta MCP `estoque_consultar` (lib/mcp/tools):
  - saldo, validade e alertas de um produto, para o assistente interno;
  - só leitura, exige `estoque.ver`;
  - **sem dados de paciente**.

## Regras do prontuário
- **Insumo sem produto do catálogo:** não baixa (consumo "livre", aparece no relatório).
- **Reabrir:** nada a desfazer. O que já foi finalizado continua imutável; procedimentos novos geram baixas novas.
- **Anular:** só acontece sem registros, então só libera reservas.
- **Erro em consumo já baixado:** adendo clínico + estorno de estoque (`estoque.estornar`, com motivo).
- **Auditoria:** só ids e contagens, nunca texto clínico. Os relatórios por paciente exigem chave clínica.

## Riscos
- **Performance da view de saldo com volume alto.** Se aparecer, cria-se uma tabela-cache com teste "cache = soma".
- **Atraso da baixa:** um ciclo do `event-log-drain` (≈1 min).
- **Dependência nova:** `fast-xml-parser`.
- **Mudanças no núcleo** (sincronia, Groq, ferramenta MCP): registro no UPSTREAM e expand/contract.
- **XML malicioso:** parser sem entidades, limite de tamanho, conferência dos bytes.
- **Escopo grande:** são 10 PRs. Os PRs E0–E3 já entregam o valor central: estoque real + baixa pelo prontuário + reserva.

## Verificação (por fase)
- Portões do repositório: `pnpm typecheck`, `pnpm lint`, `pnpm cercas`, `pnpm test:unit` e `pnpm test:db`
  (completos na primeira e na última fase).
- **Invariantes** em `tests/invariants/clinic-estoque-*.test.ts`:
  - isolamento entre 2 orgs em todas as tabelas (+ PROVA_PROPRIA);
  - movimento imutável;
  - soma = view;
  - saldo nunca negativo, inclusive com duas baixas concorrentes;
  - idempotência da baixa;
  - estorno;
  - chave de NF-e única;
  - anular libera reserva;
  - flag desligada recusa;
  - sincronia não deixa a planilha sobrescrever;
  - allowlist de definer.
- **Unitários:**
  - parser NF-e com XML fictício (rastro/med, rateio, chave);
  - de/para;
  - FEFO;
  - conversão de unidades;
  - handler com porta falsa;
  - Groq no registry;
  - auditoria sem conteúdo clínico.
- **E2E (CI):**
  1. Ligar o estoque, dar entrada com lote e montar o kit.
  2. Atender: a tela mostra saldo, lote e validade.
  3. Finalizar e drenar: o saldo baixou e o insumo aponta a operação.
  4. Upload de NF-e fictícia, conferir e lançar: saldo, custo e conta a pagar.
- **Revisões** `security-lgpd` e `health-compliance` antes da entrega final, com os achados corrigidos.

## Entrega
Um PR por fase (`feature/estoque-eN` → `develop`, "depende de #…"). Merge na ordem E0 → E9.
Atualizar `docs/tarefas/estoque/{plano,entrega}.md` e `.changes` por fase, e acompanhar CI e revisões até verde.
