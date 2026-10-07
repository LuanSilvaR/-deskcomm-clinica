# Plano de testes — cálculos financeiros

Régua única: centavos inteiros, meio para cima, e o resto do rateio na 1ª parcela. O TS (`lib/clinic/financeiro/taxas.ts`)
e o SQL (`fn_clinic_fin_calcular`) precisam dar o **mesmo** resultado.

## FN1 — motor de taxas (`lib/clinic/financeiro/taxas.test.ts`, unit)
| # | Caso | Esperado |
|---|---|---|
| T1 | R$ 3.500, crédito 6x, Cielo 11,30% (o exemplo do pedido) | MDR R$ 395,50; líquido R$ 3.104,50; 6 parcelas (a 1ª leva o resto: R$ 583,35) que somam R$ 3.500; vencimentos D+30, D+60 … D+180 |
| T2 | O mesmo, com antecipação **fixa** de 9% | antecipação R$ 279,42 (arredondada parcela a parcela); líquido antecipado R$ 2.825,08; custo total R$ 674,92 (19,28%) — o "≈ R$ 2.825 / 19,3%" do pedido |
| T3 | O mesmo, antecipação **1,5% a.m.** (juros simples por mês antecipado) | Σ líquido_i × 1,5% × meses_i ≈ 5,25% do líquido (menos que 6 × 1,5%) |
| T4 | Ton: débito, 1x, 2x, 3x, 4x, 7x, 12x, 13x, 21x | 0,57 / 0,57 / 3,97 / 3,97 / 4,97 / 7,97 / 7,97 / 14,87 / 14,87% |
| T5 | Faixa sem linha (Ton 22x; Ton Pix) | `fin_taxa_ausente` |
| T6 | Débito ou Pix em 2x | `fin_parcelas_invalidas` |
| T7 | Bandeira específica × genérica × faixa mais estreita | Amex 6% vence "todas" 5%; Visa usa 5%; 2x usa a linha de 2x (4%) |
| T8 | Tarifa fixa R$ 0,49 em 3x | tarifa só na 1ª parcela; líquido = bruto − MDR − tarifa |
| T9 | Taxa + tarifa > valor | `fin_taxa_maior_que_valor` |
| T10 | Prazos Pix D+0 e débito D+2 | vencimento no dia e em D+2 |
| T11 | Vigência: tabela de 01/01 a 1% e de 01/06 a 2% | venda de 31/05 usa 1%; venda de 01/06 usa 2%; antes de 01/01, nenhuma tabela |
| T12 | Preço com margem: custo R$ 1.000, margem 30%, MDR 11,3% | o menor P que satisfaz (P − MDR(P) − custo) ≥ 30% × P; P − 1 não satisfaz |
| T13 | Preço para receber R$ 3.104,50 líquidos a 11,30% | R$ 3.500,00 |
| T14 | Comparativo (mix 1x/6x/débito) entre Ton, Cielo e Mercado Pago | Ton é a mais barata; Mercado Pago (sem 1x, 6x e débito) vai para o fim |
| T15 | Arredondamento: 1 × 50%, 3 × 50%, R$ 99,99 × 0,57% | 1, 2 e 57 centavos |
| T16 | Rateio: 350000/6, 100/3, 2/3 | [58335, 58333×5], [34, 33, 33], [2, 0, 0] |

## FN1 — banco (`tests/invariants/clinic-fin-taxas.test.ts`, `pnpm test:db`)
| # | Caso |
|---|---|
| B1 | Opção desligada recusa (`financeiro_avancado_desligado`); ligar libera |
| B2 | Atendente lê, mas não configura (`acesso_proibido`); nome repetido é recusado |
| B3 | A 1ª tabela pode valer desde o passado; as seguintes, não (`fin_vigencia_no_passado`) |
| B4 | Linhas e tabelas são imutáveis (UPDATE/DELETE recusados, até para o service role); ninguém insere direto |
| B5 | Vigência futura substitui a futura; a de hoje não se reescreve; a venda de ontem usa a tabela antiga e a de amanhã, a nova |
| B6 | Linha inválida (débito 2x, MDR > 100%) recusa a tabela inteira |
| B7 | **Paridade**: cerca de 200 casos gerados (forma, bandeira, 1–22x, R$ 0,01 a R$ 20.000, datas de fim de mês, antecipar sim/não, os 2 modos de antecipação, tarifa fixa) → JSON do banco = objeto do TS, campo a campo; os casos que o TS recusa, o banco recusa com o mesmo código |
| B8 | `fn_clinic_fin_calcular` é interna: `authenticated` não executa |
| B9 | Forma de pagamento: tipo + adquirente; dinheiro com adquirente é recusado |
| B10 | Isolamento: a empresa B lê 0 em todas as tabelas e não usa a adquirente nem a forma de A; anon não executa |

## FN1 — tela (e2e `tests/e2e/clinic-fin-maquininhas.spec.ts`)
Liga a opção, cria a maquininha pelo modelo Cielo Smart, simula R$ 3.500 em 6x e espera ver R$ 395,50 de taxa e
R$ 3.104,50 de líquido.

## FN2–FN7 (a cada fase)
| Fase | Casos-chave |
|---|---|
| FN2 | **Pagamento dividido:** a soma tem de bater o total (a mais ou a menos é recusado). Gera as **parcelas** (vencimentos, rateio, soma = bruto). **Taxa como saída:** soma das saídas = MDR + tarifa. **Comissão sobre o líquido:** item R$ 1.000 a 40%, comanda com 10% de taxa → R$ 360,00. **Snapshot:** mudar a tabela depois não altera a venda. **Estorno** zera parcelas, taxa e comissão. **Antecipação** gera o lançamento correto. **Opção desligada:** a finalização antiga continua igual (regressão do 0351). |
| FN3 | **Caixa:** não abre dois caixas na mesma conta; diferença = contado − esperado. **Dupla conferência:** acima do limite, a mesma pessoa não confere. O fundo de troco não vira receita. |
| FN4 | **Pacote 10 sessões / R$ 1.900:** competência no mês da venda; saldo a consumir após 3 sessões = R$ 1.330. **Produto:** baixa o estoque e congela o custo. |
| FN5 | **DRE = soma dos lançamentos** por grupo, nos dois regimes, com dados conhecidos. Provisão de imposto = alíquota × receita. CSV com totais iguais aos da tela. |
| FN6 | **Indicadores:** ticket, retenção, no-show, ocupação, receita por hora, LTV, ROI e ROAS com dados fictícios conhecidos. **Projeção 60/90:** parcelas + recorrências + a pagar. **Ponto de equilíbrio.** **Isolamento.** |
| FN7 | e2e do painel em 1280, 1024 e 390 px; os filtros mudam os números. |

**Portões por fase:** typecheck, lint, cercas, unit e `test:db` (alvo; completo na primeira e na última fase).
