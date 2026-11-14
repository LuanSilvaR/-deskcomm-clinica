/** FORK clinic (estoque E9) — resumo da ferramenta de consulta do estoque (dados fictícios). */
import { describe, expect, it } from "vitest";

import { crmConsultarEstoque, limparBusca, resumirEstoque } from "./estoque";

describe("resumirEstoque", () => {
  const base = {
    produtos: [
      { id: "p1", codigo: "TOX", nome: "Toxina fictícia" },
      { id: "p2", codigo: "SEM", nome: "Produto sem controle" },
    ],
    configs: [{ product_id: "p1", unidade_aplicacao: "U", estoque_minimo: "100", ponto_pedido: "150" }],
    saldos: [
      { product_id: "p1", lote_id: "l1", saldo: "200" },
      { product_id: "p1", lote_id: "l2", saldo: "30" },
      { product_id: "p1", lote_id: "l3", saldo: "50" },
    ],
    lotes: [
      { id: "l1", validade: "2099-01-01" },
      { id: "l2", validade: "2020-01-01" },
      { id: "l3", validade: "2030-06-30" },
    ],
    reservas: [{ product_id: "p1", quantidade: "40" }],
    alertas: [
      { product_id: "p1", tipo: "lote_vencido" },
      { product_id: "p1", tipo: "lote_vencido" },
    ],
  };

  it("soma saldo, tira vencido e reservado do disponível e acha a próxima validade", () => {
    const [p] = resumirEstoque(base, "2026-10-03");
    expect(p).toEqual({
      nome: "Toxina fictícia",
      codigo: "TOX",
      unidade: "U",
      saldo: 280,
      reservado: 40,
      disponivel: 210,
      estoque_minimo: 100,
      ponto_pedido: 150,
      proxima_validade: "2030-06-30",
      quantidade_vencida: 30,
      alertas: ["lote_vencido"],
    });
  });

  it("produto sem configuração de estoque fica fora", () => {
    expect(resumirEstoque(base, "2026-10-03").map((p) => p.codigo)).toEqual(["TOX"]);
  });

  it("o resultado não carrega paciente nem custo", () => {
    const chaves = Object.keys(resumirEstoque(base, "2026-10-03")[0]!);
    expect(chaves.some((k) => /contact|paciente|atendimento|profissional|custo/.test(k))).toBe(false);
  });
});

describe("limparBusca", () => {
  it("tira curingas e separadores do filtro", () => {
    expect(limparBusca("tox%,in_a()")).toBe("tox in a");
  });
});

describe("crm_estoque_consultar", () => {
  it("é só leitura, papel agent e escopo mcp:read", () => {
    expect(crmConsultarEstoque.category).toBe("read");
    expect(crmConsultarEstoque.requiresRole).toBe("agent");
    expect(crmConsultarEstoque.requiresScope).toBe("mcp:read");
  });
});
