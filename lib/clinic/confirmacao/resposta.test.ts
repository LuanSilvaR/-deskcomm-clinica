import { describe, expect, it } from "vitest";

import { interpretarResposta } from "./resposta";

describe("interpretarResposta", () => {
  it.each(["SIM", "Sim!", "sim.", "Confirmo", "confirmado", "OK", "👍", "Sim, confirmo", "sim confirmada", "Sí", "si"])(
    "%s → sim",
    (t) => expect(interpretarResposta(t)).toBe("sim"),
  );

  it.each(["Não", "NAO", "não posso", "Não vou poder", "cancelar", "Preciso remarcar", "❌", "No", "no puedo"])("%s → não", (t) =>
    expect(interpretarResposta(t)).toBe("nao"),
  );

  it.each([
    "Sim, mas posso chegar 10 min atrasada?",
    "qual o endereço?",
    "sim ou não?",
    "não entendi",
    "",
    "   ",
    null,
  ])("%s → nada (conversa, não confirmação)", (t) => expect(interpretarResposta(t)).toBeNull());
});
