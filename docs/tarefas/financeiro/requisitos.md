# Controle Financeiro Empresarial — requisitos

Pedido do dono (2026-10-07). Persona: **a gestora/dona da clínica**. Ela precisa ver cada centavo que entra e sai e o
impacto real das taxas de cartão em cada procedimento.

Decisões do dono:
- documentos **e** implementação;
- comissão sobre o **líquido da taxa**;
- exportação em **PDF + CSV**;
- ROI/ROAS com o gasto **lançado à mão** (etiqueta de campanha ou investimento).

Tudo fica atrás da opção **`settings.clinic.financeiro_avancado`**, que nasce desligada. Desligada, a comanda e o
faturamento funcionam exatamente como hoje.

## Fases (1 PR cada)
| Fase | Migration | Entrega |
|---|---|---|
| FN1 | 9039 | Motor de taxas: adquirentes, tabelas por vigência, tipo da forma de pagamento, simulador |
| FN2 | 9040 | Recebimentos: pagamento dividido, parcelas a receber, taxa como saída, comissão sobre o líquido, antecipação, simulador e alerta de margem no fechamento |
| FN3 | 9041 | Caixa diário: abertura, fundo de troco, suprimento, sangria, caixa pequeno, fechamento com dupla conferência |
| FN4 | 9042 | Produto e pacote na comanda, consumo de sessões, saldo a consumir, painel competência × caixa |
| FN5 | 9043 | DRE (competência e caixa), plano de contas da clínica, provisão de imposto, etiqueta de campanha e investimento, exportação |
| FN6 | 9044 | Indicadores, lucro real por procedimento, projeção de caixa 60/90 dias, simulador de cenários |
| FN7 | — | Painel da gestora (dashboard) |
| FN8 | — | Revisão de segurança e qualidade, e2e de ponta a ponta |

## Requisitos funcionais

### Pilar 3 — Motor de taxas (FN1)
- **RF-01** Cadastrar uma ou mais adquirentes (maquininhas) com:
  - nome;
  - prazo de recebimento do Pix, do débito e do crédito (D+N; no crédito parcelado, a parcela *i* cai em D+N+30×(i−1));
  - tarifa fixa por transação;
  - taxa de antecipação, cobrada **por mês antecipado** (juros simples por parcela) ou **fixa** (% único sobre o líquido de cada parcela ainda não vencida);
  - situação ativa ou inativa.
- **RF-02** Tabela de taxas por adquirente: linhas de **modalidade** (Pix, débito, crédito) × **faixa de parcelas** (1 a 24) × **bandeira** (Visa, Mastercard, Elo, Amex, Hipercard, outras, ou "todas") → **MDR %** com até 4 casas.
  - A linha da bandeira específica vence a linha "todas".
  - Entre linhas que servem, vence a faixa mais estreita.
- **RF-03** **A taxa nunca muda o passado.** Editar é publicar uma **vigência** nova, que vale de hoje em diante.
  - Só a primeira tabela pode valer desde uma data passada.
  - Uma vigência futura (que ainda não valeu) pode ser substituída.
  - Tabelas e linhas são imutáveis no banco.
- **RF-04** Modelos de referência para começar sem digitar: Ton, Cielo Smart e Mercado Pago, com os valores do pedido.
  - A tela sempre avisa "ajuste ao seu contrato".
  - Onde a fonte não traz a faixa, a linha não existe e o simulador avisa.
- **RF-05** Cada forma de pagamento ganha um **tipo** (dinheiro, Pix, débito, crédito, boleto, transferência, outro) e, se passa pela maquininha, **a adquirente**.
- **RF-06** **Simulador de recebimento líquido.** A partir de valor, forma, parcelas, bandeira e antecipar, mostra:
  - MDR (% e R$), tarifa, líquido, a data e o valor de cada parcela;
  - custo da antecipação e líquido antecipado;
  - custo total para a clínica (R$ e %).
- **RF-07** **Alerta de margem.** Com o custo direto informado (insumos + comissão), mostra a margem depois da taxa e alerta quando ela fica abaixo do mínimo configurável (padrão 30%).
- **RF-08** **Embutir custo no preço.** Sugere o menor preço que mantém a margem desejada naquela forma e parcela: (P − MDR(P) − tarifa − custo) ≥ margem × P.
- **RF-09** **Comparativo entre adquirentes.** Mostra a mesma venda em cada maquininha ativa, da mais barata para a mais cara.
  - Na FN6 o comparativo passa a usar o **mix real** dos últimos 90 dias.
- **RF-10** **Parcelado "sem juros" é custo da clínica.** O simulador e o fechamento explicam isso e mostram o impacto na margem.

### Pilar 2 — Visão centavo a centavo (FN2–FN5)
- **RF-11** No fechamento da comanda, com a opção ligada:
  - **pagamento dividido** em várias formas (a soma tem de bater o total);
  - para cada forma, as parcelas e a bandeira;
  - **simulador ao vivo** e alerta de margem antes de finalizar.
- **RF-12** A finalização gera:
  - a **receita bruta** com competência na data da venda;
  - uma **conta a receber por parcela** (vencimento D+N);
  - a **taxa** como saída (`card_fee`);
  - dinheiro e Pix sem maquininha já entram como recebidos.
  - A taxa é congelada no pagamento (snapshot da vigência).
- **RF-13** Comissão sobre o líquido: base = total do item × (líquido ÷ bruto da comanda). Configurável por clínica (`liquido` ou `bruto`).
- **RF-14** **Contas a receber:**
  - baixa de parcela recebida;
  - parcelas vencidas e não baixadas ficam marcadas como atrasadas (cron);
  - antecipação de parcelas com simulação, confirmação e o lançamento da taxa de antecipação.
- **RF-15** **Caixa diário:**
  - abertura com fundo de troco;
  - suprimento, sangria e caixa pequeno, cada um como categoria própria;
  - fechamento com contagem, diferença calculada e **dupla conferência** (segunda pessoa com `financeiro.conferir`) quando há diferença ou o valor passa do limite configurado;
  - saldo do dia comparado com ontem e com a média da semana.
- **RF-16** **Produto na comanda:** venda de home care com custo congelado; baixa o estoque quando ele está ligado.
- **RF-17** **Pacote de N sessões:**
  - a receita entra na **data da venda**, no regime de competência (o exemplo do pedido: "março ganhou R$ 1.900");
  - cada sessão realizada baixa o pacote;
  - o painel mostra o **saldo a consumir** (sessões pagas e não realizadas × valor por sessão) como passivo operacional.
- **RF-18** **Painel duplo:** competência × caixa, mês a mês, lado a lado.
- **RF-19** **DRE mensal** nos dois regimes:
  - linhas: receita bruta; (−) impostos; (−) custos variáveis (insumos, comissões, taxas de cartão); (=) margem de contribuição; (−) custos fixos; (=) resultado líquido;
  - exportação em PDF e CSV.
- **RF-20** O plano de contas ganha um **grupo de DRE**. Ao ligar a opção, o sistema cria um plano padrão de clínica se a empresa não tiver plano nenhum.
- **RF-21** **Imposto:** alíquota configurável (ex.: Simples sobre a receita), usada como provisão no DRE. O sistema não emite guia.
- **RF-22** **Etiqueta do lançamento:** campanha, investimento/equipamento e fornecedor (base do ROI/ROAS).

### Pilar 1 — Indicadores e painel (FN6–FN7)
- **RF-23** Indicadores filtráveis por período, profissional, sala e procedimento:
  - faturamento bruto e líquido;
  - ticket médio por atendimento;
  - receita por paciente único;
  - receita de produtos por paciente;
  - margem líquida;
  - margem bruta por procedimento;
  - ocupação da agenda (por profissional e dia da semana);
  - receita por hora de cabine;
  - no-show;
  - retenção;
  - ROI por investimento ou campanha;
  - ROAS;
  - LTV.
- **RF-24** **Lucro real por procedimento:**
  - colunas: bruto, forma de pagamento, taxa aplicada, líquido, insumos, comissão, lucro;
  - destaque dos procedimentos com margem negativa e dos de maior margem.
- **RF-25** **Projeção de caixa em 60 e 90 dias:** parcelas previstas + recorrências + contas a pagar pendentes.
- **RF-26** **Simulador de cenários:**
  - capacidade × ocupação × ticket × dias úteis;
  - "e se a ocupação subir X%";
  - ponto de equilíbrio = custos fixos ÷ margem de contribuição %.
- **RF-27** **Painel da gestora** com o layout do pedido:
  - **topo:** faturamento do dia, ticket, atendimentos, ocupação;
  - **centro:** entradas e saídas dos últimos 30 dias e saldo projetado;
  - **lateral:** margem líquida, no-show, retenção, receita por hora;
  - **rodapé:** top 5 por rentabilidade e alertas de margem negativa.

## Requisitos não funcionais
- **RNF-01 Exatidão:**
  - dinheiro em **centavos inteiros** e percentual com até 4 casas;
  - arredondamento **meio para cima**, feito em inteiros;
  - rateio com o resto na 1ª parcela.
  - TS e SQL usam a mesma régua, provada por **teste de paridade**.
- **RNF-02 Imutabilidade:**
  - lançamento pago não muda;
  - taxa por vigência;
  - estorno no lugar de apagar;
  - nada de hard-delete.
- **RNF-03 Multi-empresa:**
  - toda tabela nova tem `organization_id` + RLS + prova de isolamento com 2 empresas;
  - a empresa sempre vem da sessão, nunca do corpo da requisição.
- **RNF-04 Permissões:**
  - `financeiro.ver` para ler;
  - `financeiro.taxas` para configurar maquininhas;
  - `financeiro.lancar` para fechar comanda;
  - `financeiro.caixa` e `financeiro.conferir` para o caixa;
  - `financeiro.dashboard` para indicadores e DRE.
  - Nenhuma delas é clínica.
- **RNF-05 Privacidade:**
  - indicadores agregados;
  - relatório por procedimento sem nome de paciente;
  - auditoria só com ids, datas e contagens.
- **RNF-06 Desempenho:**
  - painel em até 2 s com 1 ano de dados (índices por organização e data);
  - "tempo real" = Realtime nas comandas e lançamentos, mais recálculo ao focar a tela.
- **RNF-07 Uso:**
  - tablet primeiro (alvos de 44 px);
  - funciona em 390 px;
  - espanhol completo.
- **RNF-08 Reversível:** desligar a opção volta a comanda ao fluxo antigo, e os dados ficam.

## Fora do escopo
- Integração automática com adquirentes (extrato, conciliação por API).
- Emissão de guia de imposto.
- NFS-e: é o módulo "Notas fiscais", com plano próprio.

## Decisões da clínica (não são do sistema)
- A tabela de taxas do **seu contrato**. Os modelos são só referência pública.
- Alíquota de imposto, margem mínima e limite da dupla conferência.
