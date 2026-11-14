# #142 — Claude Haiku 5.5 pela chave da Anthropic

Issue: https://github.com/LuanSilvaR/-deskcomm-clinica/issues/142

## Por quê
O dono está no Brasil, com o dólar alto e pouco crédito na Anthropic. O Haiku 5.5 custa 10× menos que o Haiku 4.5
(US$ 0,10 / 0,50 por MTok contra 1 / 5) e a chave da Anthropic já dá acesso a ele, mas o sistema não o oferecia.

## O que mudou
- **Migration 8017** (tripla): `claude-haiku-5-5` em `ai_models` (provider `anthropic`, source `manual`) e em `ai_pricing`.
  O seletor de modelo do agente passa a oferecê-lo; antes ele só existia pela OpenRouter (outra chave).
- **`lib/agent-engine/edge/llm/pricing.ts`**: tarifa do Haiku 5.5. Sem ela, `costCents` devolvia `null`, a tela de Uso
  mostrava zero e o teto de orçamento da organização não disparava.
- **`fecharTurnoComCheckpoint`** (`lib/agent-engine/agent/inbound-turn.ts`): o checkpoint do fechamento é pedido em JSON
  livre; quando o modelo erra o formato, repete só essa chamada (até 2 tentativas) em vez de subir o erro e a fila
  re-rodar o turno inteiro. Esgotadas as tentativas, o comportamento é o de antes. O ledger de envio já impedia
  mensagem duplicada; o que se evita aqui é pagar o turno duas vezes.

## Medição (prova de 15 cenários da Sofia, modo prévia)
| Versão | Modelo | Custo médio/resposta | Erros de checkpoint |
|---|---|---|---|
| v2 (publicada antes) | Haiku 4.5 | US$ 0,039 (conversa real) | — |
| v3 | Haiku 4.5 | US$ 0,017 | 0/15 |
| v3, código antigo | Haiku 5.5 | US$ 0,0026 | 1/15 (turno re-tentado) |
| v4, este código | Haiku 5.5 | US$ 0,0025 | 0/15; custo registrado pelo motor em 75/75 chamadas |

A v4 da Sofia foi publicada no DSV com este código (worker rodando a branch).

## Verify
- `pnpm lint`: 0 erros (427 avisos, todos pré-existentes).
- `pnpm typecheck`: limpo.
- `pnpm test:db`: 310/310 arquivos verdes.
- `pnpm test:unit`: 1384 arquivos verdes, 17 vermelhos. Desses, 16 também falham na `develop` limpa, sem `.env`
  (linha de base do #140, 18 arquivos, ligados a ambiente). O 17º, `gateway-destino-por-caminho`, só falha com
  `.env.local` presente e passa sem ele (`wt-baseline-gw2`). Nenhuma regressão.
- Testes novos: `checkpoint-tenta-de-novo-so-o-fechamento` (4) e o bloco do Haiku 5.5 em `pricing.test.ts`.

## Depois do merge
- Aplicar a migration 8017 em homologação (3002) antes de escolher o Haiku 5.5 num agente de lá.
- O worker do DSV hoje roda a partir desta worktree; depois do merge, volte a rodá-lo a partir da `develop`.
