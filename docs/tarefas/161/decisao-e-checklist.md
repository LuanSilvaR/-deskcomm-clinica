# #161 — Provedor de pagamento da plataforma: decisão e checklist de produção

Refs #161 · épico #158 (card 03/22) · depende de #160 (mergeado na `develop` em 2026-11-13).

## 1. Decisão do dono (2026-11-13)

**Provedor: Stripe.**

- O código já atende os dois provedores (`lib/cobranca/provedores/{stripe,asaas}.ts`, card #160). A
  decisão muda só o padrão da tela **Conexão** (`/admin/cobranca`): a Stripe vem selecionada e o
  Asaas continua no seletor.
- Até o checklist da seção 4 estar aprovado pelo dono, vale **só a chave de teste**: `sk_test_…` ou
  `rk_test_…`.
- **Valor do teste com dinheiro real:** o dono decide na hora da homologação. O campo fica em aberto
  no checklist.

## 2. Comparação para o caso das clínicas

As tarifas abaixo vêm de fontes públicas e variam por contrato. Antes da produção, confira-as na
conta (checklist, item A3). Nenhum valor aqui é proposta comercial.

| Critério | Stripe (escolhido) | Asaas |
|---|---|---|
| Meios na assinatura | Cartão recorrente, cobrado sozinho todo mês. Boleto disponível no Brasil. | Pix, boleto ou cartão: o cliente escolhe na fatura (`billingType: UNDEFINED`) |
| Pix avulso | Não, para o caso das clínicas. No Brasil, o Pix na Stripe vem pela parceria com a EBANX e é voltado a transações internacionais. | Sim, em cada fatura |
| Pix Automático | Não | Sim, pela API (jornadas 3 e 4). Exige um fluxo próprio de autorização e não está implementado. |
| NFS-e | Não emite nota fiscal brasileira. É preciso outro serviço ou a emissão manual. | Emite pela API, cerca de R$ 0,49 por nota |
| Portal do cliente | Sim (Customer Portal): trocar o cartão, ver faturas e cancelar | Link da fatura (`invoiceUrl`), sem portal completo |
| Estorno | Pelo painel ou pela API (refund) | Pelo painel ou pela API |
| Tarifa de cartão (referência) | A conferir na página de preços da Stripe Brasil | Cerca de 2,75% a 2,99% + R$ 0,49 |
| Tarifa de Pix ou boleto (referência) | — | Pix de R$ 0 a 1,99; boleto de cerca de R$ 1,79 a 1,99 |
| Webhook | Registrado sozinho pela API (`EVENTOS_DO_WEBHOOK_STRIPE`), com HMAC no corpo cru | Registrado pela API ou à mão, com token |

**Pix avulso e Pix Automático são coisas diferentes:**

- **Pix avulso:** o cliente paga uma fatura por QR Code ou copia-e-cola, a cada mês.
- **Pix Automático:** o cliente autoriza uma vez no banco, e as cobranças seguintes são debitadas
  sozinhas. Exige um fluxo próprio de autorização (consentimento, eventos de autorização e
  revogação).

Com a Stripe, **nenhum dos dois** entra no escopo. Se o dono quiser Pix no futuro, abre-se um card
próprio, e o Asaas já está pronto no seletor para o Pix avulso. O Pix Automático continua não
implementado em qualquer provedor.

**Consequência da escolha para a NFS-e:** a Stripe não emite nota fiscal municipal. A emissão da
nota da mensalidade fica para o card fiscal do épico (ou é feita à mão pelo contador) e precisa
estar resolvida antes da primeira cobrança real (checklist, item D2).

Fontes consultadas em 2026-11-13: documentação do Pix Automático do Asaas
(docs.asaas.com/docs/pix-automatico), emissão de NFS-e para assinaturas no Asaas
(docs.asaas.com/docs/emitir-notas-fiscais-automaticamente-para-assinaturas), notícia da parceria
Stripe + EBANX para o Pix (finsidersbrasil.com.br) e comparativos de tarifa de terceiros. A tabela
oficial de preços da Stripe Brasil não foi lida e precisa ser conferida no item A3.

## 3. O que o sistema já garante (card #160)

- A chave fica cifrada em `platform_config` e a tela mostra só os 4 últimos caracteres.
- O modo sai do prefixo da chave: `sk_test_` e `rk_test_` são teste; `sk_live_` e `rk_live_` são
  produção.
- **Publicação:** trocar a chave de teste pela de produção pede confirmação, e as clínicas que
  assinaram em teste voltam para o teste grátis.
- A tela recusa trocar de conta ou de provedor enquanto houver assinatura paga.
- O webhook só funciona num endereço https público, confere a assinatura (HMAC) e não duplica avisos
  repetidos.
- A régua de cobrança (avisos, suspensão e reativação) roda de hora em hora (`cron/cobranca`).
- Tudo fica atrás do módulo `cobranca`, que vem desligado.

## 4. Checklist de produção

Nenhuma cobrança real acontece antes de **todos** os itens estarem marcados e de o dono aprovar.

### A. Conta e chave
- [ ] A1. A conta Stripe está ativada no nome da empresa da plataforma: dados bancários, CNPJ e
      verificação concluída.
- [ ] A2. A chave de produção é **restrita** (`rk_live_…`), com permissão só para Customers,
      Checkout Sessions, Subscriptions, Invoices, Prices/Products, Billing Portal e Webhook
      Endpoints. Ela é gerada pelo dono e colada **só pela tela Conexão**, nunca em `.env`, chat ou
      código.
- [ ] A3. Tarifas de cartão e de boleto conferidas na conta e anotadas aqui:
      `____________________`.
- [ ] A4. Os planos estão cadastrados em `/admin/cobranca` com os preços finais. O preço não fica
      fixo no código.

### B. Endereço e aviso de pagamento (webhook)
- [ ] B1. O domínio de produção responde em https público com certificado válido, e
      `NEXT_PUBLIC_APP_URL` aponta para ele.
- [ ] B2. Depois de conectar, o endpoint aparece no painel da Stripe (Developers › Webhooks) com os
      8 eventos de `EVENTOS_DO_WEBHOOK_STRIPE`.
- [ ] B3. Um evento de teste enviado pelo painel chega com 2xx e aparece uma única vez em
      `webhook_events_log`.

### C. E-mail e avisos
- [ ] C1. O e-mail transacional (Resend) está configurado, com domínio verificado.
- [ ] C2. Os e-mails da régua (fim do teste, fatura vencida, aviso final e suspensão) chegaram na
      homologação em modo de teste.

### D. Fiscal e contábil
- [ ] D1. O contador confirmou o tratamento da receita e da comissão. Pendência do épico #158.
- [ ] D2. A emissão da NFS-e da mensalidade está definida (card fiscal ou emissão manual), porque a
      Stripe não emite nota fiscal.

### E. Homologação (modo de teste, na 3002 ou na VPS de teste)
- [ ] E1. Fluxo completo com cartão de teste: Assinar › checkout › volta › "Já paguei" › estado
      `ativa`.
- [ ] E2. Cartão recusado (`4000 0000 0000 0341`): a fatura fica em atraso, a régua avisa, e a
      suspensão e a reativação funcionam ao pagar.
- [ ] E3. Cancelamento pelo portal reflete no painel da clínica.

### F. Teste com dinheiro real
- [ ] F1. Valor máximo autorizado pelo dono: `R$ ______` (decidido na homologação).
- [ ] F2. Um plano de teste com esse valor, assinado pelo próprio dono e **estornado** logo depois;
      o estorno é conferido no painel da Stripe.
- [ ] F3. O plano de teste é arquivado depois.

### G. Plano de reversão
- [ ] G1. **Parar tudo na hora:** desligar o módulo em `/admin/sistema › Cobrança da plataforma`.
      As rotas e a faixa somem e a régua para. As assinaturas continuam na Stripe.
- [ ] G2. **Voltar ao modo de teste:** só é possível sem assinatura paga (a tela recusa). Com
      assinaturas pagas, a reversão passa por cancelar no painel da Stripe ou pela tela da clínica.
- [ ] G3. **Clínica suspensa por engano:** em `/admin/tenants`, reativar dá 7 dias de prazo extra.
      A régua não suspende de novo nesse prazo.
- [ ] G4. **Cobrança indevida:** estornar pelo painel da Stripe, registrar o motivo e avisar a
      clínica.

### Aprovação
- [ ] Checklist revisado e aprovado pelo dono em `____/____/______`.
