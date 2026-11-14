import { describe, expect, it } from "vitest";

import { escolhasCompletas } from "./tipos";

describe("escolhasCompletas", () => {
  const opcoes = [
    { chave: "site", rotulo: "Site" },
    { chave: "ciencia", rotulo: "Li e entendi", obrigatoria: true },
  ];
  it("toda opção respondida; obrigatória com sim", () => {
    expect(escolhasCompletas(opcoes, { site: false, ciencia: true })).toBe(true);
    expect(escolhasCompletas(opcoes, { site: false })).toBe(false);
    expect(escolhasCompletas(opcoes, { site: true, ciencia: false })).toBe(false);
    expect(escolhasCompletas(opcoes, { site: true, ciencia: true, extra: true })).toBe(false);
    expect(escolhasCompletas([], {})).toBe(true);
  });
});
