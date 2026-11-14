import { describe, expect, it } from "vitest";

import { montarPosicao, type ConfigDoProduto } from "./posicao";

const config = (over: Partial<ConfigDoProduto> = {}): ConfigDoProduto => ({
  id: "c1",
  product_id: "p1",
  ean: null,
  ncm: null,
  registro_anvisa: null,
  unidade_estoque: "frasco",
  unidade_aplicacao: "U",
  fator_conversao: 100,
  fracionavel: true,
  validade_pos_abertura_horas: 24,
  rastreado: true,
  controlado: false,
  conselhos_permitidos: [],
  estoque_minimo: 150,
  ponto_pedido: null,
  gerenciado: true,
  versao: 1,
  ...over,
});

const base = {
  produtos: [
    { id: "p1", codigo: "TOX", nome: "Toxina fictícia", ativo: true },
    { id: "p2", codigo: "AGU", nome: "Agulha fictícia", ativo: true },
    { id: "p3", codigo: "OLD", nome: "Inativo sem estoque", ativo: false },
  ],
  configs: [config()],
  lotes: [
    { id: "l-tarde", product_id: "p1", codigo: "B", validade: "2099-12-31", custo_unitario_cents: "1000.0000" },
    { id: "l-cedo", product_id: "p1", codigo: "A", validade: "2030-01-31", custo_unitario_cents: 900 },
    { id: "l-vencido", product_id: "p1", codigo: "V", validade: "2020-01-01", custo_unitario_cents: null },
    { id: "l-zerado", product_id: "p1", codigo: "Z", validade: "2031-01-01", custo_unitario_cents: null },
  ],
  saldos: [
    { product_id: "p1", lote_id: "l-tarde", local_id: "central", saldo: "60.000" },
    { product_id: "p1", lote_id: "l-cedo", local_id: "central", saldo: 30 },
    { product_id: "p1", lote_id: "l-cedo", local_id: "sala", saldo: 10.5 },
    { product_id: "p1", lote_id: "l-vencido", local_id: "central", saldo: 5 },
  ],
};

describe("montarPosicao", () => {
  const [agulha, toxina] = montarPosicao(base, { hoje: "2026-10-03", verCustos: true });

  it("ordena por nome, esconde inativo sem configuração e soma o saldo de todos os lotes e locais", () => {
    expect([agulha?.nome, toxina?.nome]).toEqual(["Agulha fictícia", "Toxina fictícia"]);
    expect(toxina?.saldo).toBe(105.5);
    expect(agulha?.saldo).toBe(0);
    expect(agulha?.config).toBeNull();
  });

  it("lotes em FEFO, sem lote zerado, com saldo por local e vencido marcado", () => {
    expect(toxina?.lotes.map((l) => l.codigo)).toEqual(["V", "A", "B"]);
    expect(toxina?.lotes[0]?.vencido).toBe(true);
    expect(toxina?.lotes[1]?.por_local).toEqual([
      { local_id: "central", saldo: 30 },
      { local_id: "sala", saldo: 10.5 },
    ]);
  });

  it("próxima validade ignora lote vencido; abaixo do mínimo compara com o total", () => {
    expect(toxina?.proxima_validade).toBe("2030-01-31");
    expect(toxina?.abaixo_do_minimo).toBe(true);
  });

  it("custo só para quem pode ver custos", () => {
    expect(toxina?.lotes.find((l) => l.codigo === "B")?.custo_unitario_cents).toBe(1000);
    const [, semCusto] = montarPosicao(base, { hoje: "2026-10-03", verCustos: false });
    expect(semCusto?.lotes.every((l) => l.custo_unitario_cents === null)).toBe(true);
  });
});
