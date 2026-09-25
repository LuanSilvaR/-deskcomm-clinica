import { describe, expect, it } from "vitest";

import { camposMudaram, chaveDoRotulo, mover, opcoesDoTexto } from "./editor";

describe("chaveDoRotulo", () => {
  it("gera chave estável, sem acento, e única", () => {
    expect(chaveDoRotulo("Queixa principal", new Set())).toBe("queixa_principal");
    expect(chaveDoRotulo("Exposição solar?", new Set())).toBe("exposicao_solar");
    expect(chaveDoRotulo("Queixa principal", new Set(["queixa_principal"]))).toBe("queixa_principal_2");
    expect(chaveDoRotulo("2 sessões", new Set())).toBe("c_2_sessoes");
    expect(chaveDoRotulo("???", new Set())).toBe("campo");
  });
});

describe("opcoesDoTexto", () => {
  it("uma opção por linha, sem vazias", () => {
    expect(opcoesDoTexto("Seca\n\n Oleosa \nSeca")).toEqual([
      { valor: "seca", rotulo: "Seca" },
      { valor: "oleosa", rotulo: "Oleosa" },
      { valor: "seca_2", rotulo: "Seca" },
    ]);
  });
});

describe("mover e camposMudaram", () => {
  it("move sem sair da lista", () => {
    expect(mover(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(mover(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(mover(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
  it("detecta mudança real", () => {
    const c = [{ chave: "a", rotulo: "A", tipo: "texto" as const }];
    expect(camposMudaram(c, [{ ...c[0]! }])).toBe(false);
    expect(camposMudaram(c, [{ ...c[0]!, obrigatorio: true }])).toBe(true);
  });
});
