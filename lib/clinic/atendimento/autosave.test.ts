import { describe, expect, it } from "vitest";

import { FilaDeGravacao, type EstadoDoAutosave } from "./autosave";

class Conflito extends Error {}

function montar(versaoInicial = 0) {
  const chamadas: Array<{ valor: string; versao: number }> = [];
  const estados: EstadoDoAutosave["tipo"][] = [];
  const resolvers: Array<(r: { versao: number } | Error) => void> = [];
  const fila = new FilaDeGravacao<string>(
    (valor, versao) =>
      new Promise((ok, falha) => {
        chamadas.push({ valor, versao });
        resolvers.push((r) => (r instanceof Error ? falha(r) : ok(r)));
      }),
    versaoInicial,
    (e) => estados.push(e.tipo),
    (e) => e instanceof Conflito,
  );
  const responder = async (r: { versao: number } | Error) => {
    resolvers.shift()!(r);
    await new Promise((res) => setTimeout(res, 0));
  };
  return { fila, chamadas, estados, responder };
}

describe("fila de gravação do autosave", () => {
  it("uma gravação em voo; o que muda no meio vira UMA próxima, com a versão nova", async () => {
    const { fila, chamadas, estados, responder } = montar(0);
    const p = fila.enviar("a");
    void fila.enviar("ab");
    void fila.enviar("abc");
    expect(chamadas).toEqual([{ valor: "a", versao: 0 }]);
    await responder({ versao: 1 });
    expect(chamadas).toEqual([
      { valor: "a", versao: 0 },
      { valor: "abc", versao: 1 },
    ]);
    await responder({ versao: 2 });
    await p;
    expect(fila.versao).toBe(2);
    expect(estados.at(-1)).toBe("salvo");
  });

  it("conflito para tudo: nada mais é enviado", async () => {
    const { fila, chamadas, estados, responder } = montar(3);
    const p = fila.enviar("x");
    void fila.enviar("xy");
    await responder(new Conflito());
    await p;
    await fila.enviar("xyz");
    expect(chamadas).toHaveLength(1);
    expect(fila.emConflito).toBe(true);
    expect(estados.at(-1)).toBe("conflito");
  });

  it("erro comum não perde o texto: 'tentar de novo' reenvia o mesmo valor", async () => {
    const { fila, chamadas, estados, responder } = montar(1);
    const p = fila.enviar("texto");
    await responder(new Error("rede"));
    await p;
    expect(estados.at(-1)).toBe("erro");
    const p2 = fila.tentarDeNovo();
    await responder({ versao: 2 });
    await p2;
    expect(chamadas.map((c) => c.valor)).toEqual(["texto", "texto"]);
    expect(estados.at(-1)).toBe("salvo");
  });
});
