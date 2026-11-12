# #143 — Balões do agente chegam fora de ordem no WhatsApp

Issue: https://github.com/LuanSilvaR/-deskcomm-clinica/issues/143

## Sintoma
Sofia no DSV (2026-11-10, `split_messages` ligado):
- 15:47:34 "Como posso ajudá-lo hoje?" → 15:47:37 "Boa tarde, Luan! Sou Sofia…" (o cumprimento chegou por último)
- 15:59:04 "você topa remarcar?" → 15:59:06 "Entendi, você quer cancelar."

## Causa
Não é o fatiamento (`sendInBubbles` envia em sequência). Com `split_messages` ligado, o prompt pede "várias mensagens
curtas" e o modelo passa a chamar `send_message` **várias vezes no mesmo passo**. O SDK `ai@7` executa as tool-calls
de um passo com `Promise.all` (`executeTools` em `ai/dist/index.js`), em paralelo:

1. a 1ª chamada liga `jaEsperouComoHumano` e paga a pausa humana (`esperaForaDoLock`, 1,2 s a 7,5 s);
2. as seguintes veem o flag ligado, pulam a espera, tomam o lock do número e enviam antes.

O intervalo de 3 s entre os balões do registro é a pausa humana. Efeito colateral: o `seq` do ledger de envio também
saía fora da ordem de escrita. Isso explica também o "cada balão passa sozinho pelo `promise_semantic`": cada
`send_message` é um envio próprio e passa pela própria cadeia de gates.

## Conserto
`lib/agent-engine/agent/fila-de-envio.ts`: uma fila por turno. `send_message` e `send_template` entram nela no mesmo
tique em que o SDK os chama (na ordem do array de tool-calls), e cada um só começa quando o anterior termina, seja com
sucesso, veto ou erro. Turnos diferentes continuam concorrentes; a serialização por número segue sendo o advisory
lock do `before-send.ts`.

Fica fora deste card: as chamadas extras ao `promise_semantic` (uma por balão). Elas são o desenho do gate (cada
envio é julgado). Se o custo incomodar, a solução é outro card (julgar o passo inteiro de uma vez).

## Testes
- `tests/invariants/baloes-do-turno-saem-em-ordem.test.ts` (turno completo, SDK real, modelo fake com 3 e 4
  tool-calls no mesmo passo e `sleep` real comprimido 50×). **Antes do conserto:** os 2 testes falharam, com o 1º
  balão chegando por último, igual ao WhatsApp. **Depois:** verdes, com `seq` 1, 2, 3.
- `lib/agent-engine/agent/fila-de-envio.test.ts` (4): ordem de entrada, concorrência 1, erro não trava a fila,
  filas de turnos diferentes independentes.
- Vizinhos de envio verdes: `limite-de-envios-por-turno`, `case-guardrail`, `rascunho-envio-vetado-reescreve`,
  `case-reply-turn`, `followup-turn-bridge`.

## Depois do merge
Com isto, `split_messages` pode voltar a ser ligado na Sofia (hoje desligado como contorno, desde a v3).
