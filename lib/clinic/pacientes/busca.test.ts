import { describe, expect, it } from "vitest";

import { detalheDoPaciente, interpretarBusca } from "./busca";

describe("interpretarBusca", () => {
  it("data válida vira busca por nascimento", () => {
    expect(interpretarBusca("10/05/1990")).toEqual({ tipo: "nascimento", data: "1990-05-10" });
    expect(interpretarBusca("10-05-1990")).toEqual({ tipo: "nascimento", data: "1990-05-10" });
  });

  it("data impossível não vira nascimento", () => {
    expect(interpretarBusca("31/02/1990")?.tipo).not.toBe("nascimento");
  });

  it("CPF válido (com ou sem pontuação) busca por CPF ou telefone", () => {
    expect(interpretarBusca("529.982.247-25")).toEqual({ tipo: "cpf_ou_telefone", digitos: "52998224725" });
    expect(interpretarBusca("52998224725")).toEqual({ tipo: "cpf_ou_telefone", digitos: "52998224725" });
  });

  it("11 dígitos que não são CPF são telefone", () => {
    expect(interpretarBusca("(11) 99999-0000")).toEqual({ tipo: "telefone", digitos: "11999990000" });
  });

  it("trecho de telefone a partir de 4 dígitos", () => {
    expect(interpretarBusca("9000")).toEqual({ tipo: "telefone", digitos: "9000" });
    expect(interpretarBusca("123")?.tipo).toBe("nome");
  });

  it("nome tira os caracteres do DSL do PostgREST", () => {
    expect(interpretarBusca("Maria (Silva), 100%")).toEqual({ tipo: "nome", termo: "Maria  Silva   100" });
  });

  it("vazio não busca", () => {
    expect(interpretarBusca("   ")).toBeNull();
  });
});

describe("detalheDoPaciente", () => {
  it("mostra só o fim do telefone e o nascimento", () => {
    expect(detalheDoPaciente("+5511999991234", "1990-05-10")).toBe("•••• 1234 · 10/05/1990");
    expect(detalheDoPaciente(null, null)).toBeNull();
  });
});
