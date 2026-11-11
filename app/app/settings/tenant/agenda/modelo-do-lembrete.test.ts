import { describe, expect, it } from "vitest";

import { parteDoModeloNoPatch, valorInicialDoSeletor } from "./modelo-do-lembrete";

const base = { chaveLigada: true, lembreteLigado: true };

describe("parteDoModeloNoPatch", () => {
  it("chave ligada e valor inalterado: a chave não vai no PATCH", () => {
    expect(parteDoModeloNoPatch({ ...base, inicial: "", atual: "" })).toEqual({});
    expect(parteDoModeloNoPatch({ ...base, inicial: "m1", atual: "m1" })).toEqual({});
  });
  it("mudou para Nenhum: null", () => {
    expect(parteDoModeloNoPatch({ ...base, inicial: "m1", atual: "" })).toEqual({ reminder_meta_template_id: null });
  });
  it("mudou para um modelo: o id", () => {
    expect(parteDoModeloNoPatch({ ...base, inicial: "", atual: "m2" })).toEqual({ reminder_meta_template_id: "m2" });
  });
  it("chave ou lembrete desligado: nunca vai", () => {
    expect(parteDoModeloNoPatch({ ...base, chaveLigada: false, inicial: "m1", atual: "" })).toEqual({});
    expect(parteDoModeloNoPatch({ ...base, lembreteLigado: false, inicial: "m1", atual: "" })).toEqual({});
  });
});

describe("valorInicialDoSeletor", () => {
  it("modelo salvo fora da lista aparece como Nenhum", () => {
    expect(valorInicialDoSeletor("velho", ["m1"])).toBe("");
    expect(valorInicialDoSeletor("m1", ["m1"])).toBe("m1");
    expect(valorInicialDoSeletor(null, ["m1"])).toBe("");
  });
});
