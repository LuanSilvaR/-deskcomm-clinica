import { describe, expect, it } from "vitest";

import { casarItens, semelhanca, type BaseDeCasamento } from "./depara";
import type { ItemDaNfe } from "./parser";

const item = (over: Partial<ItemDaNfe>): ItemDaNfe => ({
  numero: 1,
  codigo: "X",
  descricao: "",
  ean: null,
  ncm: null,
  unidade: "UN",
  quantidade: 1,
  valor_unitario_cents: 0,
  valor_total_cents: 0,
  custo_total_cents: 0,
  registro_anvisa: null,
  rastro: [],
  ...over,
});

const base: BaseDeCasamento = {
  produtos: [
    { id: "tox", nome: "Toxina botulínica fictícia 100U" },
    { id: "gaze", nome: "Gaze estéril fictícia" },
    { id: "luva", nome: "Luva de procedimento" },
  ],
  configs: [
    { product_id: "tox", ean: "07891234567895", fator_conversao: 100 },
    { product_id: "gaze", ean: null, fator_conversao: 1 },
  ],
  historico: [{ codigo: "LV-9", product_id: "luva", fator: 50 }],
};

describe("semelhanca", () => {
  it("ignora acento e caixa", () => {
    expect(semelhanca("GAZE ESTERIL FICTICIA", "Gaze estéril fictícia")).toBe(1);
    expect(semelhanca("abc", "xyz")).toBe(0);
  });
});

describe("casarItens", () => {
  const [hist, ean, nome, nada] = casarItens(
    [
      item({ codigo: "LV-9", descricao: "LUVA NITRILICA CX 50", ean: "07891234567895" }),
      item({ codigo: "T1", ean: "07891234567895", rastro: [{ lote: "L1", quantidade: 2, validade: "2028-01-31", fabricacao: null }] }),
      item({ codigo: "G1", descricao: "GAZE ESTERIL FICTICIA" }),
      item({ codigo: "Z", descricao: "PRODUTO DESCONHECIDO" }),
    ],
    base,
  );

  it("histórico do fornecedor vence o EAN", () => {
    expect(hist).toMatchObject({ product_id: "luva", origem_casamento: "historico", fator: 50 });
  });
  it("EAN usa o fator do produto e o lote do rastro único", () => {
    expect(ean).toEqual({ product_id: "tox", origem_casamento: "ean", fator: 100, lote: "L1", validade: "2028-01-31" });
  });
  it("nome parecido sugere; sem casamento fica para a conferência", () => {
    expect(nome).toMatchObject({ product_id: "gaze", origem_casamento: "nome", fator: 1 });
    expect(nada).toEqual({ product_id: null, origem_casamento: null, fator: null, lote: null, validade: null });
  });
});
