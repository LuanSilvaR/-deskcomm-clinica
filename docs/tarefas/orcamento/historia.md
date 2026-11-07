# Orçamento → Contrato — história e critérios de aceite

Pedido do dono (2026-11-07): todo paciente que passar por atendimento pode receber um **orçamento**. Se o paciente aprovar,
o orçamento vira um **contrato de prestação de serviço**.

Decisões do dono:
- **Aprovação em um passo:** aprovar o orçamento é aceitar o contrato gerado com os itens e valores congelados, presencialmente (tablet) ou por link.
- **Tabela de preços nova:** preço por procedimento e por pacote de N sessões; desconto limitado por permissão.
- **Depois do aceite:** o sistema gera o **plano de tratamento** com as sessões contratadas e a **cobrança**.

Classificação: **G** (épico com sub-issues; banco, RLS, documentos jurídicos e financeiro).

## História
**Como** profissional ou recepção da clínica,
**quero** montar um orçamento com os procedimentos indicados no atendimento e enviá-lo ao paciente,
**para que** ele aprove e o aceite já valha como contrato, com o plano de tratamento e a cobrança prontos, sem redigitar nada.

**Como** gestora,
**quero** uma tabela de preços com vigência, limite de desconto por papel e a taxa de conversão dos orçamentos,
**para** controlar o preço praticado e acompanhar quanto foi vendido.

## Critérios de aceite
1. **Tabela de preços com vigência.**
   - **Dado** que a gestora (com `orcamentos.precos`) cadastrou "Toxina — 1 sessão: R$ 1.200" e "Toxina — pacote 3 sessões: R$ 3.000" valendo desde hoje,
   - **quando** um orçamento é criado,
   - **então** esses são os preços sugeridos.
   - **E** mudar o preço amanhã não altera orçamentos já enviados.
2. **Orçamento a partir do atendimento.**
   - **Dado** um atendimento em andamento ou finalizado,
   - **quando** o profissional abre a seção "Orçamento" e clica "Novo orçamento",
   - **então** o orçamento nasce em **rascunho**, ligado ao paciente, ao atendimento e ao profissional.
   - **E** sugere os itens a partir do plano de tratamento em rascunho, se houver.
3. **Itens e total.**
   - **Dado** um rascunho,
   - **quando** adiciono itens (procedimento × sessões ou pacote) e um desconto,
   - **então** subtotal, desconto e total são calculados em centavos, com o mesmo resultado na tela e no banco.
4. **Limite de desconto.**
   - **Dado** que o papel "Atendente" tem limite de 10%,
   - **quando** ele aplica 15%,
   - **então** o envio fica bloqueado até alguém com `orcamentos.aprovar_desconto` aprovar o desconto.
   - **E** a aprovação fica auditada.
5. **Condição de pagamento.**
   - **Dado** um rascunho,
   - **quando** escolho a forma: **dinheiro, Pix, cartão de débito, cartão de crédito (à vista) ou parcelado** (cartão de
     crédito em 2 a N vezes, com entrada opcional em dinheiro, Pix ou débito),
   - **então** a condição aparece no orçamento e no contrato.
   - **E** o contrato mostra, por extenso, a **forma de pagamento**, a **entrada** (se houver), o **nº de parcelas** com o
     **valor de cada uma** e o **total**.
   - **E** a soma da entrada com as parcelas é igual ao total do orçamento; o centavo que sobra do rateio vai na 1ª parcela.
   - **E** nenhuma outra forma (boleto, transferência, crediário) pode ser escolhida.
   - **E**, com as taxas cadastradas em Configurações › Maquininhas (débito, crédito à vista e crédito por nº de parcelas),
     a tela mostra **só para a clínica** a taxa %, o valor da taxa e o líquido estimado de cada forma; a taxa não aparece no
     contrato, a não ser que a clínica ligue o repasse ao paciente.
6. **Enviar gera o contrato.**
   - **Dado** um rascunho válido,
   - **quando** clico "Enviar",
   - **então** itens, preços e total ficam **congelados**, o status vira **enviado**, e é emitido um documento do tipo
     **contrato** (modelo da clínica) com os itens, os valores e a condição de pagamento no texto, com sha256.
7. **Aceite presencial.**
   - **Dado** um orçamento enviado,
   - **quando** o paciente aceita no tablet (nome digitado),
   - **então** o contrato fica **aceito** e o orçamento **aprovado**, com data, canal e registrado por.
8. **Aceite por link.**
   - **Dado** um orçamento enviado,
   - **quando** gero o link (WhatsApp ou copiar) e o paciente aceita na página pública,
   - **então** o resultado é o mesmo do critério 7, com IP e navegador registrados.
   - **E** o link é de uso único e expira.
9. **Recusa e validade.**
   - **Dado** um orçamento enviado,
   - **quando** o paciente recusa, ou a validade (padrão 15 dias, configurável) passa,
   - **então** o status vira **recusado** ou **expirado**, o contrato é cancelado e o link deixa de funcionar.
10. **Nova versão.**
    - **Dado** um orçamento enviado e ainda não aceito,
    - **quando** clico "Revisar",
    - **então** nasce a versão 2 em rascunho e a versão 1 fica **substituída**, com o contrato cancelado.
    - **E** nada do que já foi aceito muda.
11. **Pós-aceite: plano de tratamento.**
    - **Dado** um orçamento aprovado com "Toxina — pacote 3 sessões",
    - **então** é criado um plano de tratamento com 3 sessões **planejadas**, ligado ao orçamento e ao atendimento de origem.
12. **Pós-aceite: cobrança.**
    - **Dado** um orçamento aprovado,
    - **então** é aberta uma comanda "Contrato #N" com os itens e o total.
    - **E** o caixa a finaliza com a forma e as parcelas combinadas. Com o financeiro da clínica (#58), as parcelas viram contas a receber.
13. **Imutabilidade.** Orçamento enviado ou aprovado e contrato aceito não se alteram, nem por fora das funções. Distrato é revogação do contrato mais o estorno da cobrança.
14. **Acesso.**
    - Quem não tem `orcamentos.ver` não vê orçamentos.
    - A recepção vê orçamento e contrato **sem** ver o prontuário.
    - O orçamento não guarda texto clínico.
15. **Isolamento.** Uma empresa não lê nem altera orçamento, preço ou contrato de outra (teste com 2 empresas).
16. **Opção desligada.** Com `settings.clinic.orcamentos` desligado, nada aparece e as funções recusam.
17. **Indicadores.** A lista de orçamentos mostra o funil (enviados, aprovados, recusados, expirados), a taxa de conversão e o valor aprovado no mês.
18. **PDF.** O contrato aceito pode ser baixado em PDF com texto, itens, sha256 e os dados do aceite.

## Fora do escopo
- Assinatura digital certificada (ICP-Brasil). O aceite é eletrônico simples, como os termos de hoje.
- Envio pelo WhatsApp do servidor (WAHA). Continua o link `wa.me`, como nos termos.
- Texto jurídico das cláusulas (distrato, multa, reembolso): decisão da clínica, no modelo editável.
- Cobrança automática por boleto, Pix ou cartão online.

## Issues para o quadro (Backlog)
O `gh` desta sessão não estava autenticado. Crie com `R=LuanSilvaR/-deskcomm-clinica`, ligando as sub-issues ao épico
(`docs/backlog.md`, "Comandos úteis").

- **Épico — Orçamento → Contrato.** Corpo: link para `docs/tarefas/orcamento/` e critérios 1–18.
- **O1 — Tabela de preços com vigência.** Critério 1.
- **O2 — Orçamento em rascunho (itens, desconto com limite, condição de pagamento, versão).** Critérios 2–5, 10, 14–16.
- **O3 — Enviar gera o contrato; aceite presencial e por link; recusa; validade; PDF.** Critérios 6–9, 13, 18.
- **O4 — Pós-aceite: plano de tratamento e comanda.** Critérios 11–12. Depende do #58 para as parcelas.
- **O5 — Lista, indicadores, revisões de segurança e conformidade, e2e de ponta a ponta.** Critério 17 e revisão geral.
