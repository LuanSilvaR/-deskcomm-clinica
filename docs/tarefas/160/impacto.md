# Card #160 — Cobrança: provedores, checkout, webhook e régua (épico #158, card 02)

Fatiado em 3 PRs empilhados (decisão do dono, 2026-11-13):

| PR | Escopo | Migration |
|---|---|---|
| **160a** (este) | contrato de provedores, adaptadores **Asaas** e **Stripe** (modo de teste), aba **Conexão** em `/admin/cobranca` (chave cifrada, só os 4 últimos na tela), **webhook** autenticado e idempotente | **8027** (upstream 0601 §A/§B/§G) |
| 160b | checkout hospedado, `/cobranca/contratar` e `volta` (o redirect NÃO confirma pagamento), `/app/settings/billing`, faixa, central; `sincronizar` (releitura no provedor) e a emissão de `cobranca.sinal` pelo webhook | — |
| 160c | régua de avisos, suspensão/reativação, `cron/cobranca`, e-mails da cobrança | 8028 (upstream 9027), 8029 (upstream 0809) |

## 160a — o que entrou

- `lib/cobranca/provedores/{contrato,asaas,stripe,base-de-teste,index}.ts` e `lib/cobranca/{configuracao,falhas,url,documento,fuso}.ts`
  copiados do upstream (b3a0724) sem mudança de comportamento; testes do upstream junto (adaptadores com HTTP falso).
- `POST /api/v1/admin/cobranca/conexao`: testa a chave DIGITADA, recusa chave Asaas sem marca de ambiente, recusa trocar de
  provedor/chave com assinatura paga, registra o aviso no provedor e grava cifrado (`platform_config`). Guarda do fork
  (`lib/cobranca/guarda.ts`). Auditoria: `cobranca.provedor_conectado`, `cobranca.modo_publicado`.
- `POST /api/v1/webhooks/cobranca/[provedor]`: confere a assinatura no corpo CRU (Stripe HMAC; Asaas token em tempo
  constante), recusa adulterado com 401 e rastro sem corpo, grava PONTEIRO `{id,type}` sem org; repetido não duplica
  (índice `uniq_webhook_events_log_cobranca`). **Ainda não emite `cobranca.sinal`**: o consumidor chega no 160b.
- Migration 8027: provedores no CHECK do arquivo de webhooks, índice de idempotência, trava da exclusão de org com
  assinatura viva (`PT409 organizacao_com_assinatura_viva`).

## Diferenças em relação ao upstream (e por quê)

- Sem `requirePlatformAdminEscrita` no fork → `guardaDaCobranca` (platform admin `full` + MFA + módulo ligado).
- Sem e-mails da cobrança (`lib/cobranca/emails`, `lib/email/templates/cobranca`) → a troca de chave fica na auditoria; o
  e-mail "a chave mudou" chega no 160c.
- Sem `aplicarRegua`/`sincronizar` → a publicação (teste → produção) devolve quem assinou em teste ao teste grátis, sem
  reativar suspensão (o fork ainda não suspende).
- `documento.test.ts`: o caso cadastro × cobrança depende de `lib/crm-b2b/normalize`, que o fork não tem; removido.
- Asaas é o provedor padrão na tela (Pix e boleto, clientes no Brasil). O #161 decide o provedor de produção.

## Chave sandbox e prova ponta a ponta

Nada real: toda a suíte usa HTTP falso e o dublê de bancada (`COBRANCA_API_BASE_URL_TESTE`, só em loopback). O critério
"no sandbox do Asaas: assinar, pagar, atrasar, suspender e reativar" só fecha depois do 160c, na homologação (precisa de URL
https pública para o aviso e da chave `$aact_hmlg_…` cadastrada pela tela Conexão — nunca no código ou no `.env`).

## 160b — o que entrou

- `lib/cobranca/sincronizar.ts` (releitura no provedor, compare-and-set em `updated_at`/`relida_em`, leitura que falha
  grava só `ultimo_erro`), `estado.ts`, `sinal.handler.ts` registrado no dispatcher; o webhook passa a emitir
  `cobranca.sinal` e fechar o ponteiro (`processed`).
- `lib/cobranca/checkout.ts` e as rotas `/api/v1/cobranca/assinatura/{checkout,sincronizar,gerenciar,cancelar}` (admin da
  empresa, org da sessão, `Idempotency-Key`, CPF/CNPJ vai direto ao provedor e não é guardado).
- `/cobranca/volta` (ponte: o redirect do provedor NÃO confirma pagamento — a tela relê), `/app/settings/billing` com o
  painel e as ações (Assinar, Pagar agora, Já paguei, Gerenciar, Cancelar), faixa da cobrança no topo do `/app`.

## 160b — diferenças em relação ao upstream

- **Sem a régua** em `sincronizar` (`aplicarRegua` devolve `"nada"`): avisos, suspensão/reativação por cobrança, e-mails e
  itens da Central chegam no 160c. Ninguém é suspenso por esta leitura.
- **Sem a troca de plano** com ajuste proporcional (`troca.ts`, rota `/assinatura/plano`, UI de "Trocar de plano").
- **Sem `/cobranca/contratar`** (continuação do cadastro com intenção assinada): o fork cria clínica pelo admin da
  plataforma; a contratação pelo próprio cliente fica para quando houver cadastro aberto com plano.
- Dispatcher do fork sem `naOrgParada`: o handler roda sempre. `requireRole` do fork sem `permiteOrgSuspensa`.
- `uso.ts`: a constante do canal pareado por QR mora local (não mexe em `lib/channels/capabilities.ts`); o caso que confere
  os gatilhos de limite volta com o #162.
