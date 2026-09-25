import { describe, expect, it } from "vitest";

import { marcadoresDesconhecidos, renderizarTermo } from "./render";

describe("renderizarTermo", () => {
  it("troca os marcadores conhecidos; vazio vira lacuna; desconhecido fica", () => {
    expect(
      renderizarTermo("Eu, {{paciente.nome}}, na {{ clinica.nome }}: {{procedimento}}. {{outra.coisa}}", {
        "paciente.nome": "Pessoa Fictícia",
        "clinica.nome": "Clínica Teste",
        procedimento: "  ",
      }),
    ).toBe("Eu, Pessoa Fictícia, na Clínica Teste: __________. {{outra.coisa}}");
  });

  it("lista só os marcadores desconhecidos, sem repetir", () => {
    expect(marcadoresDesconhecidos("{{data}} {{cpf}} {{cpf}} {{paciente.nome}}")).toEqual(["cpf"]);
  });
});
