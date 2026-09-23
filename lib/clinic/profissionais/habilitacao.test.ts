import { describe, expect, it } from "vitest";

import { clinicProfissionaisLigado } from "../flags";

import { atendeAsExigencias } from "./habilitacao";

describe("atendeAsExigencias", () => {
  it("tipo sem especialidade exigida aceita qualquer profissional", () => {
    expect(atendeAsExigencias([], [])).toBe(true);
    expect(atendeAsExigencias([], ["harmonizacao"])).toBe(true);
  });

  it("basta ter UMA das especialidades exigidas", () => {
    expect(atendeAsExigencias(["harmonizacao", "dermato"], ["dermato"])).toBe(true);
  });

  it("sem nenhuma das exigidas, não está habilitado", () => {
    expect(atendeAsExigencias(["harmonizacao"], ["laser"])).toBe(false);
    expect(atendeAsExigencias(["harmonizacao"], [])).toBe(false);
  });
});

describe("clinicProfissionaisLigado", () => {
  it("só o booleano true liga", () => {
    expect(clinicProfissionaisLigado({ clinic: { profissionais: true } })).toBe(true);
  });

  it.each([
    ["settings nulo", null],
    ["sem clinic", {}],
    ["clinic não-objeto", { clinic: "sim" }],
    ["false", { clinic: { profissionais: false } }],
    ["string 'true'", { clinic: { profissionais: "true" } }],
    ["array", []],
  ])("%s → desligado", (_rotulo, settings) => {
    expect(clinicProfissionaisLigado(settings)).toBe(false);
  });
});
