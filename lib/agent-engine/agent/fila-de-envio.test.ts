import { describe, expect, it } from "vitest";

import { criarFilaDeEnvio } from "./fila-de-envio";

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("criarFilaDeEnvio (#143)", () => {
  it("chamadas em paralelo saem na ordem de entrada, mesmo quando a 1ª demora mais", async () => {
    const fila = criarFilaDeEnvio();
    const saida: string[] = [];
    const envio = (rotulo: string, ms: number) =>
      fila(async () => {
        await espera(ms);
        saida.push(rotulo);
        return rotulo;
      });

    // Mesmo formato do SDK: Promise.all sobre as tool-calls do passo.
    const resultados = await Promise.all([envio("1", 40), envio("2", 5), envio("3", 0)]);

    expect(saida).toEqual(["1", "2", "3"]);
    expect(resultados).toEqual(["1", "2", "3"]);
  });

  it("um envio só começa depois que o anterior terminou", async () => {
    const fila = criarFilaDeEnvio();
    let emAndamento = 0;
    let picoDeConcorrencia = 0;
    const envio = () =>
      fila(async () => {
        emAndamento += 1;
        picoDeConcorrencia = Math.max(picoDeConcorrencia, emAndamento);
        await espera(5);
        emAndamento -= 1;
      });

    await Promise.all([envio(), envio(), envio(), envio()]);
    expect(picoDeConcorrencia).toBe(1);
  });

  it("um envio que falha devolve o erro a quem chamou e não trava os seguintes", async () => {
    const fila = criarFilaDeEnvio();
    const saida: string[] = [];

    const [a, b, c] = await Promise.allSettled([
      fila(async () => {
        saida.push("1");
        return "ok-1";
      }),
      fila(async () => {
        saida.push("2");
        throw new Error("canal fora");
      }),
      fila(async () => {
        saida.push("3");
        return "ok-3";
      }),
    ]);

    expect(saida).toEqual(["1", "2", "3"]);
    expect(a).toEqual({ status: "fulfilled", value: "ok-1" });
    expect(b.status).toBe("rejected");
    expect((b as PromiseRejectedResult).reason.message).toBe("canal fora");
    expect(c).toEqual({ status: "fulfilled", value: "ok-3" });
  });

  it("filas diferentes (turnos diferentes) não esperam uma pela outra", async () => {
    const turnoA = criarFilaDeEnvio();
    const turnoB = criarFilaDeEnvio();
    const saida: string[] = [];

    await Promise.all([
      turnoA(async () => {
        await espera(30);
        saida.push("A");
      }),
      turnoB(async () => {
        saida.push("B");
      }),
    ]);

    expect(saida).toEqual(["B", "A"]);
  });
});
