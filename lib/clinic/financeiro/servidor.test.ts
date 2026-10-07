import { describe, expect, it } from "vitest";

import { MODELOS_DE_ADQUIRENTE } from "./modelos";
import { lerConfigFinanceiro, MARGEM_MINIMA_PADRAO, simular, type Maquininhas } from "./servidor";

describe("lerConfigFinanceiro", () => {
  it("padrões: desligado, comissão sobre o líquido, margem 30%", () => {
    expect(lerConfigFinanceiro(null)).toEqual({ ligado: false, comissao_base: "liquido", margem_minima_pct: MARGEM_MINIMA_PADRAO, limite_conferencia_cents: 500_000 });
  });
  it("lê o que a clínica salvou; valor estranho cai no padrão", () => {
    expect(
      lerConfigFinanceiro({ clinic: { financeiro_avancado: true, fin: { comissao_base: "bruto", margem_minima_pct: 25 } } }),
    ).toEqual({ ligado: true, comissao_base: "bruto", margem_minima_pct: 25, limite_conferencia_cents: 500_000 });
    expect(lerConfigFinanceiro({ clinic: { financeiro_avancado: "sim", fin: { comissao_base: "x", margem_minima_pct: "25" } } })).toEqual({
      ligado: false,
      comissao_base: "liquido",
      margem_minima_pct: MARGEM_MINIMA_PADRAO,
      limite_conferencia_cents: 500_000,
    });
  });
});

describe("simular", () => {
  const cielo = MODELOS_DE_ADQUIRENTE.find((m) => m.chave === "cielo_smart")!;
  const ton = MODELOS_DE_ADQUIRENTE.find((m) => m.chave === "ton")!;
  const maq: Maquininhas = {
    formas: [],
    adquirentes: [
      { id: "c", nome: "Cielo", modelo: "cielo_smart", ativo: true, ...cielo.adquirente, tabelas: [{ id: "t1", vigente_desde: "2026-01-01", linhas: cielo.linhas }] },
      { id: "t", nome: "Ton", modelo: "ton", ativo: true, ...ton.adquirente, tabelas: [{ id: "t2", vigente_desde: "2026-01-01", linhas: ton.linhas }] },
    ],
  };
  it("o exemplo do pedido, com alerta de margem e preço sugerido", () => {
    const r = simular(
      maq,
      { adquirente_id: "c", modalidade: "credito", bandeira: null, parcelas: 6, bruto_cents: 350000, antecipar: false, custo_cents: 200000, data: "2026-03-10" },
      "America/Sao_Paulo",
    )!;
    expect(r.recebimento?.liquido_cents).toBe(310450);
    // (310450 − 200000) ÷ 350000 = 31,56% → acima de 30%, sem alerta
    expect(r.margem_pct).toBe(31.56);
    expect(r.alerta_margem).toBe(false);
    expect(r.comparativo[0]?.nome).toBe("Ton");
    const apertado = simular(maq, { adquirente_id: "c", modalidade: "credito", bandeira: null, parcelas: 6, bruto_cents: 350000, antecipar: false, custo_cents: 250000, data: "2026-03-10" }, null)!;
    expect(apertado.alerta_margem).toBe(true);
    expect(apertado.preco_sugerido_cents).toBeGreaterThan(350000);
  });
  it("faixa sem taxa vira erro, não exceção; maquininha desconhecida → null", () => {
    expect(simular(maq, { adquirente_id: "c", modalidade: "credito", bandeira: null, parcelas: 4, bruto_cents: 1000, antecipar: false }, null)?.erro).toBe(
      "fin_taxa_ausente",
    );
    expect(simular(maq, { adquirente_id: "x", modalidade: "pix", bandeira: null, parcelas: 1, bruto_cents: 1000, antecipar: false }, null)).toBeNull();
  });
});
