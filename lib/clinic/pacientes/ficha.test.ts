import { describe, expect, it } from "vitest";

import { idadeEm, situacaoDaFicha, type DadosDaFicha } from "./ficha";

const HOJE = "2026-09-23";

function completa(p: Partial<DadosDaFicha> = {}): DadosDaFicha {
  return {
    nome: "Maria da Silva",
    temCpf: true,
    nascimento: "1990-05-10",
    sexo: "feminino",
    telefone: "+5511999990000",
    cep: "01310100",
    logradouro: "Avenida Paulista",
    numero: "1000",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP",
    emergenciaNome: "João da Silva",
    emergenciaParentesco: "Irmão",
    emergenciaTelefone: "+5511988887777",
    responsavelNome: null,
    temCpfDoResponsavel: false,
    responsavelParentesco: null,
    ...p,
  };
}

describe("situacaoDaFicha", () => {
  it("adulto com tudo preenchido: completa, sem responsável", () => {
    expect(situacaoDaFicha(completa(), HOJE)).toEqual({ completa: true, faltando: [], menorDeIdade: false });
  });

  it("primeiro contato do WhatsApp (só nome e telefone) lista tudo o que falta, na ordem da ficha", () => {
    const r = situacaoDaFicha(
      completa({
        temCpf: false,
        nascimento: null,
        sexo: null,
        cep: null,
        logradouro: null,
        numero: null,
        bairro: null,
        cidade: null,
        uf: null,
        emergenciaNome: null,
        emergenciaParentesco: null,
        emergenciaTelefone: null,
      }),
      HOJE,
    );
    expect(r.completa).toBe(false);
    expect(r.faltando).toEqual([
      "CPF",
      "Data de nascimento",
      "Sexo",
      "CEP",
      "Logradouro",
      "Número",
      "Bairro",
      "Cidade",
      "UF",
      "Contato de emergência",
      "Parentesco do contato de emergência",
      "Telefone do contato de emergência",
    ]);
  });

  it("nome de uma palavra só não é nome completo", () => {
    expect(situacaoDaFicha(completa({ nome: "Maria" }), HOJE).faltando).toEqual(["Nome completo"]);
    expect(situacaoDaFicha(completa({ nome: "   " }), HOJE).faltando).toEqual(["Nome completo"]);
  });

  it("menor de idade exige responsável com CPF e parentesco", () => {
    const r = situacaoDaFicha(completa({ nascimento: "2010-01-01" }), HOJE);
    expect(r.menorDeIdade).toBe(true);
    expect(r.faltando).toEqual(["Nome do responsável", "CPF do responsável", "Parentesco do responsável"]);
    expect(
      situacaoDaFicha(
        completa({ nascimento: "2010-01-01", responsavelNome: "Ana Souza", temCpfDoResponsavel: true, responsavelParentesco: "Mãe" }),
        HOJE,
      ).completa,
    ).toBe(true);
  });

  it("faz 18 no próprio dia: já é adulto", () => {
    expect(situacaoDaFicha(completa({ nascimento: "2008-09-23" }), HOJE).menorDeIdade).toBe(false);
    expect(situacaoDaFicha(completa({ nascimento: "2008-09-24" }), HOJE).menorDeIdade).toBe(true);
  });
});

describe("idadeEm", () => {
  it("conta anos completos sem passar por fuso", () => {
    expect(idadeEm("1990-05-10", "2026-05-09")).toBe(35);
    expect(idadeEm("1990-05-10", "2026-05-10")).toBe(36);
    expect(idadeEm("2000-02-29", "2026-02-28")).toBe(25);
  });
});
