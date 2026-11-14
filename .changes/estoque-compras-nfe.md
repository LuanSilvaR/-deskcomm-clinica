---
impacto: nada_mudou
secao: adicionado
titulo: Entrada de estoque pelo XML da NF-e
---

Na tela Estoque, a nova aba Compras (NF-e) recebe o arquivo .xml que o fornecedor envia. O sistema lê a nota e sugere o produto de cada item: pelo histórico daquele fornecedor, pelo código de barras (EAN) ou pelo nome. Também já preenche o lote e a validade quando a nota traz essas informações.

Nada entra sem conferência. Item a item, confirme o produto, quantas unidades de uso vêm em cada unidade da nota (por exemplo, 1 caixa = 50 luvas), o lote e a validade, ou marque "Ignorar" para frete e brindes. Ao clicar em "Lançar no estoque", o sistema faz a seguinte entrada:
- os lotes, com o custo de cada item já incluindo frete, seguro, IPI e ST, menos o desconto;
- o aprendizado do produto de cada código daquele fornecedor, para sugerir certo na próxima nota;
- uma conta a pagar pendente no financeiro, se você escolher.

A mesma nota não entra duas vezes. Com o estoque desligado, nada muda.
