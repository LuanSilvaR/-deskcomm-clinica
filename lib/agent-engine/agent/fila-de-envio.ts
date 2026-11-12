/**
 * Fila de envio do turno (issue #143): o que o modelo manda ao cliente sai na
 * ORDEM EM QUE ELE ESCREVEU, um envio por vez.
 *
 * Por que precisa existir: o SDK (`ai`) executa as tool-calls de um mesmo passo
 * com `Promise.all`, em paralelo. Com `split_messages` ligado o modelo é
 * instruído a mandar "várias mensagens curtas" e passa a chamar `send_message`
 * várias vezes no MESMO passo. A 1ª chamada paga a pausa humana do turno
 * (`esperaForaDoLock`) e as seguintes, vendo o flag `jaEsperouComoHumano` já
 * ligado, tomavam o lock do número antes dela — o cumprimento chegava por
 * último no WhatsApp, e o `seq` do ledger de envio ficava fora da ordem de escrita.
 *
 * A ordem de ENTRADA é a ordem de escrita: o `Promise.all` do SDK chama cada
 * `execute` na ordem do array de tool-calls, e cada um entra na fila no mesmo
 * tique em que começa (antes de qualquer `await` nosso). Cada envio começa só
 * quando o anterior TERMINA — com sucesso, veto ou erro: uma falha não trava os
 * seguintes, e o resultado de cada um volta intacto para quem o chamou.
 *
 * Escopo: UMA fila por turno (criada no closure do run), nunca global — turnos
 * de leads diferentes seguem concorrentes; a serialização POR NÚMERO continua
 * sendo do advisory lock de `before-send.ts`.
 */
export type FilaDeEnvio = <T>(envio: () => Promise<T>) => Promise<T>;

export function criarFilaDeEnvio(): FilaDeEnvio {
  let anterior: Promise<unknown> = Promise.resolve();
  return <T>(envio: () => Promise<T>): Promise<T> => {
    const este = anterior.then(envio);
    // A cauda da fila nunca rejeita: o erro de um envio pertence a quem o pediu
    // (devolvido em `este`), não ao próximo da fila.
    anterior = este.then(
      () => undefined,
      () => undefined,
    );
    return este;
  };
}
