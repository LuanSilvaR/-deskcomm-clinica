# Modelo de dados — Financeiro da clínica

O que já existe (núcleo, migrations 0350–0359) **não muda de forma incompatível**:
- `sales` / `sale_items` (comanda);
- `financial_entries` (lançamentos);
- `financial_accounts`, `payment_methods`, `account_plans`;
- `commissions`, `recurring_entries`.

As tabelas novas são `clinic_fin_*`. Todas têm `organization_id` com cascade, RLS por empresa + `financeiro.ver`, e
escrita só por funções `fn_clinic_fin_*`.

```
organizations ─┬─ clinic_fin_adquirentes ── clinic_fin_tabelas (vigência) ── clinic_fin_taxas (linhas)
               │          ▲
               │          └──────────── clinic_fin_forma_extras ── payment_methods (núcleo)
               │
               ├─ sales (núcleo) ── clinic_fin_pagamentos ── clinic_fin_parcelas ── financial_entries (núcleo)
               │       │                    (FN2)                 (FN2)          (receivable / card_fee / anticipation)
               │       └─ sale_items ── clinic_fin_item_extras (produto, custo, pacote)       (FN4)
               │                              └── clinic_fin_pacotes ── clinic_fin_pacote_consumos (FN4)
               ├─ clinic_fin_caixas ── clinic_fin_caixa_movimentos                              (FN3)
               ├─ account_plans (núcleo) ── clinic_fin_grupos_conta (grupo de DRE)              (FN5)
               └─ financial_entries ── clinic_fin_lancamento_extras (campanha, investimento,     (FN5)
                                                                    fornecedor)
```

## FN1 (migration 9039) — entregue
| Tabela | Colunas principais | Regras |
|---|---|---|
| `clinic_fin_adquirentes` | `nome`, `modelo`, `prazo_pix_dias`, `prazo_debito_dias`, `prazo_credito_dias`, `tarifa_fixa_cents`, `antecipacao_pct`, `antecipacao_modo` (`por_mes`/`fixa`), `ativo` | nome único por empresa (sem diferença de maiúsculas); prazos de 0 a 400 dias |
| `clinic_fin_tabelas` | `adquirente_id`, `vigente_desde`, `cancelada_em` | uma vigência ativa por data; **imutável** (só uma vigência futura pode ser cancelada) |
| `clinic_fin_taxas` | `tabela_id`, `bandeira` (nula = todas), `modalidade`, `parcelas_de`, `parcelas_ate`, `mdr_pct numeric(7,4)` | débito e Pix só 1x; de 1 a 24; MDR entre 0 e 100; **imutável**, até para o service role |
| `clinic_fin_forma_extras` | `payment_method_id`, `tipo`, `adquirente_id` | 1:1 com `payment_methods`; adquirente só para Pix, débito e crédito |

**Funções da FN1:**
- `fn_clinic_definir_financeiro_avancado`;
- `fn_clinic_fin_adquirente_salvar`;
- `fn_clinic_fin_tabela_publicar`;
- `fn_clinic_fin_forma_salvar`;
- `fn_clinic_fin_calcular` (interna; espelho do motor TS).

## FN2 (migration 9040) — entregue
- `clinic_fin_pagamentos` (snapshot da taxa: vigência, %, MDR, tarifa, líquido) e `clinic_fin_parcelas` (só o status muda, pelas funções).
- `financial_entries`: `competence_date` (data da venda) e `due_date` (vencimento da parcela); origens `receivable` (parcela a receber, pendente até o vencimento), `card_fee` (taxa da parcela, saída) e `anticipation` (custo de antecipar).
- Funções: `fn_clinic_fin_finalizar`, `fn_clinic_fin_estornar`, `fn_clinic_fin_receber_parcela`, `fn_clinic_fin_antecipar`, `fn_clinic_fin_baixar_vencidas` (cron `fin-parcelas`), `fn_clinic_fin_config_salvar`, `fn_clinic_fin_custo_da_comanda`.
- Regime de caixa = lançamentos pagos por data de pagamento (parcela + taxa caem juntas: entra o líquido); competência = `competence_date`.

## FN3 (migration 9041) — entregue
- `clinic_fin_caixas` (sessão por conta; uma aberta por conta; esperado × contado; diferença) e `clinic_fin_caixa_movimentos` (suprimento, sangria, caixa pequeno).
- Fundo, suprimento e sangria não viram lançamento; caixa pequeno e a diferença conferida viram `cash`.
- Funções: `fn_clinic_fin_caixa_abrir`, `_movimentar`, `_fechar`, `_conferir`, `_esperado_agora`, `fn_clinic_fin_dia` (resumo do dia).

## FN4 e FN5 (previstas)
| Tabela | Colunas principais |
|---|---|
| `clinic_fin_item_extras` | `sale_item_id`, `product_id`, `custo_cents` (congelado), `pacote_sessoes` |
| `clinic_fin_pacotes` | `sale_item_id`, `contact_id`, `sessoes`, `valor_cents`, `consumidas` (derivado dos consumos) |
| `clinic_fin_pacote_consumos` | `pacote_id`, `atendimento_id`/`appointment_id`, `em` |
| `clinic_fin_grupos_conta` | `account_plan_id`, `grupo` (`receita_bruta`, `impostos`, `custo_variavel`, `custo_fixo`, `marketing`, `investimento`, `outras`) |
| `clinic_fin_lancamento_extras` | `financial_entry_id`, `campanha`, `investimento`, `fornecedor_id` |

**Toques no núcleo** (aditivos; registrados no UPSTREAM quando entrarem):
- `financial_entries.competence_date` e `due_date`, ambas preenchidas a partir de `entry_date`;
- `origin` ganha `card_fee`, `receivable`, `anticipation` e `cash`.
