# Wireframes — Financeiro da clínica

Tablet primeiro (1024×768), com o menu da clínica à esquerda. Em 390 px as colunas viram uma pilha. A paleta e a fonte
são as do sistema (cor de destaque da marca).

## 1. Configurações › Maquininhas e taxas (FN1)
```
┌────────────────────────────────────────────────────────────────────────┐
│ Maquininhas e taxas                                                    │
│ Quanto cada maquininha cobra por forma e parcela, quando o dinheiro…   │
├────────────────────────────────────────────────────────────────────────┤
│ Maquininhas                                                            │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Cielo Smart          [Prazos e antecipação] [Editar taxas]         │ │
│ │ Recebe: Pix D+0 · débito D+1 · crédito D+30 · antecipação 1,5% a.m.│ │
│ │ Valendo desde 2026-10-07                                           │ │
│ │  Forma    Parcelas  Bandeira  Taxa                                 │ │
│ │  Pix      1x        Todas     0,99%                                │ │
│ │  Débito   1x        Todas     1,90%                                │ │
│ │  Crédito  6x        Todas     11,30%                               │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌ Nova maquininha ─────────────────────────────────────────────────┐   │
│ │ Começar de um modelo [Ton ▾]  Nome [________]  [Adicionar]       │   │
│ │ Taxas de referência pública — ajuste ao seu contrato antes de usar│   │
│ └──────────────────────────────────────────────────────────────────┘   │
│ Formas de pagamento                                                    │
│  Cartão recepção   [Crédito ▾] [Cielo Smart ▾]          [Salvar]       │
│  Dinheiro          [Dinheiro ▾]                          [Salvar]      │
│ Simulador de recebimento                                               │
│  Maquininha[Cielo▾] Valor[3.500,00] Forma[Crédito▾] Parcelas[6x▾]      │
│  Bandeira[Qualquer▾] Custo direto[____] Margem mín.[30] ☐Antecipar     │
│  [Calcular]                                                            │
│ ┌──────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │ Valor cobrado     R$ 3.500,00│ │ Quando entra                      │ │
│ │ Taxa (11,30%)     −R$  395,50│ │ 1  2026-11-06   R$ 517,41         │ │
│ │ Líquido recebido  R$ 3.104,50│ │ 2  2026-12-06   R$ 517,41  …      │ │
│ │ Custo total  R$ 395,50 (11,3%)│ ├───────────────────────────────────┤ │
│ │ ⚠ Margem abaixo do mínimo: 18%│ │ A mesma venda em cada maquininha  │ │
│ │ Preço p/ manter: R$ 4.032,10 │ │ Ton           R$ 243,95 (6,97%)   │ │
│ │ "Sem juros" é custo da clínica│ │ Cielo Smart   R$ 395,50 (11,30%) │ │
│ └──────────────────────────────┘ └───────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```
**Editar taxas** abre o editor:
- campo "Vale a partir de" (amanhã por padrão; hoje só na primeira tabela);
- linhas com Forma, De/Até parcelas, Bandeira, Taxa % e [Remover];
- botões [Adicionar linha] e [Publicar tabela].

## 2. Fechamento da comanda (FN2)
```
┌ Fechar comanda #1042 ─────────────────────────────── Total R$ 3.500,00 ┐
│ Pagamento 1  [Cartão recepção ▾] [Crédito] [6x ▾] [Visa ▾] R$ 3.000,00 │
│ Pagamento 2  [Pix ▾]                                       R$   500,00 │
│ [+ Dividir em outra forma]                    Falta: R$ 0,00 ✓         │
│ ───────────────────────────────────────────────────────────────────── │
│ Taxas: −R$ 343,95 · Líquido: R$ 3.156,05 · Entra: 6 parcelas até 04/27  │
│ Custo direto (insumos + comissão): R$ 1.200,00 · Margem: 55,8% ✓       │
│ ⚠ (quando abaixo do mínimo) "Margem de 22% — abaixo dos 30% da clínica"│
│                                              [Finalizar]               │
└────────────────────────────────────────────────────────────────────────┘
```

## 3. Caixa do dia (FN3)
```
┌ Caixa do dia — 07/10 ──────────── Aberto por Recepção às 08:02 ────────┐
│ Fundo de troco R$ 200,00   Entradas R$ 4.320,00   Saídas R$ 180,00     │
│ Saldo do dia R$ 4.140,00  (ontem R$ 3.010,00 · média 7d R$ 3.480,00)   │
│ [Suprimento] [Sangria] [Caixa pequeno]                                 │
│ Por categoria: Procedimentos R$ 3.900 · Produtos R$ 420 · …            │
│ [Fechar caixa] → contagem por espécie → diferença → conferência (2ª pessoa)│
└────────────────────────────────────────────────────────────────────────┘
```

## 4. Painel da gestora (FN7)
```
┌────────────────────────────────────────────────────────────────────────┐
│ Filtros: [Out/2026 ▾] [Profissional ▾] [Sala ▾] [Procedimento ▾]       │
├──────────────┬──────────────┬──────────────┬──────────────────────────┤
│ Hoje         │ Ticket médio │ Atendimentos │ Ocupação                 │
│ R$ 4.320 ▲12%│ R$ 612 ▲3%   │ 7 ▼1         │ 78% ▲5 p.p.              │
├──────────────┴──────────────┴──────────────┼──────────────────────────┤
│ Entradas × saídas (30 dias) [barras]       │ Margem líquida   24,1%   │
│ Saldo projetado 60/90 dias [linha]         │ No-show          6,2%    │
│                                            │ Retenção         58%     │
│                                            │ Receita/hora     R$ 410  │
├────────────────────────────────────────────┴──────────────────────────┤
│ Top 5 por rentabilidade              │ ⚠ Margem negativa              │
│ 1 Bioestimulador  R$ 1.820 (61%)     │ Limpeza de pele 12x: −4%       │
└────────────────────────────────────────────────────────────────────────┘
```

## 5. DRE (FN5)
```
┌ DRE — Outubro/2026      [Competência | Caixa]       [PDF] [CSV] ───────┐
│ Receita bruta                                   R$ 92.400,00   100,0%  │
│ (−) Impostos                                    R$  5.544,00     6,0%  │
│ (−) Custos variáveis (insumos, comissões, taxas) R$ 31.200,00   33,8%  │
│ (=) Margem de contribuição                      R$ 55.656,00    60,2%  │
│ (−) Custos fixos                                R$ 38.000,00    41,1%  │
│ (=) Resultado líquido                           R$ 17.656,00    19,1%  │
└────────────────────────────────────────────────────────────────────────┘
```
