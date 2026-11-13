# Card #159 — Cobrança: absorver do upstream os planos e as assinaturas (épico #158, card 01)

## O que entrou

| Peça | Origem upstream | No fork |
|---|---|---|
| `cobranca_planos`, `cobranca_assinaturas` | 0583 + 0601 §F (`oferecido_ao_cliente`) + 0641 + 0679 | migration **8026** (tripla: arquivo, MANIFEST, apêndice do baseline) |
| `fn_cobranca_ligada()` | 0583 | 8026 — lê `platform_config.MODULO_COBRANCA = 'ligado'` |
| Gatilho do teste grátis na criação da org | 0679 | 8026 — só com a chave ligada e criador que não é admin de plataforma |
| `fn_create_tenant_with_owner` com `plano_id` | 0679 | 8026 — UNIFICADA com a 0237 do fork (criador provisório, `settings.plan`) |
| Vocabulário, schema zod, rotas de plano | `lib/cobranca/vocabulario.ts`, `lib/schemas/cobranca-plano.ts`, `/api/v1/admin/cobranca/planos` | adaptados; guarda própria `lib/cobranca/guarda.ts` |
| Tela de planos | `/admin/cobranca` (aba Planos) | só a aba Planos |
| Chave do módulo | `MODULO_COBRANCA` | `lib/instalacao/modulos.ts` + switch em `/admin/sistema` |

Desligado (padrão): nada muda — tela 404, menu sem porta, cadastro sem plano, gatilho inerte,
`plano_id` recusado pelo banco (`cobranca_desligada`). Tenants existentes seguem sem assinatura (isentos).

## O que ficou de fora, e para qual card

- **#160** — provedor (Stripe/Asaas), checkout, webhook, sincronização, régua de avisos, suspensão e
  reativação (o fork não tem `fn_suspender_organizacao`/`fn_reativar_organizacao`). Plano com 0 dia de
  teste só marca `pagamento_inicial_pendente`: ninguém é suspenso nesta etapa.
- **#161** — escolha do provedor (decisão do dono).
- **#162** — `fn_limite_do_plano` e os gatilhos que fazem os limites (pessoas, números, IA) VALEREM.
  As colunas já existem; a tela avisa que os limites passam a valer numa etapa seguinte.
- **Sem drop de coluna**: o upstream removeu `organizations.ai_budget_cents` e `rate_limit_rps`; o fork
  mantém (regra 1, expand/contract).

## Medição: o que o upstream importa e o fork não tem

Imports de `lib/cobranca/*`, `app/admin/(protected)/cobranca/*` e `app/api/v1/admin/cobranca/**` no
upstream (b3a0724) que não existem no fork:

- **Domínio da cobrança** (vêm com #160/#162): `avisos`, `cadastro`, `configuracao`, `contratacao`,
  `documento`, `emails`, `estado`, `falhas`, `painel`, `planos`, `prorata`, `provedores/*`, `regua`,
  `rotulos`, `sincronizar`, `troca`, `url`, `uso`, `visao-geral`.
- **Infra do upstream ausente no fork**: `lib/auth/cache-curto`, `lib/crm-b2b/normalize`,
  `lib/email/templates/cobranca` (e-mails da régua), `components/admin/cobranca/CopiarLinkDePagamento`,
  `tests/helpers/banco-falso-da-cobranca`, `requirePlatformAdminEscrita` (o fork usa o desenho do POST de
  tenants: `requirePlatformAdmin` + escopo `full` + `mfaEmDividaEstrita`).
- A "central de avisos" e a lista de "Recursos opcionais" do upstream não existem no fork; nada
  desta etapa depende delas.

## Riscos

- Banco compartilhado do e2e: a spec desliga o módulo e apaga o que criou no `afterAll`.
- `cobranca_planos` sem policy (só service role); `cobranca_assinaturas` só lida pelo admin da própria
  org — provado em `tests/invariants/cobranca-planos-e-assinaturas.test.ts`.
