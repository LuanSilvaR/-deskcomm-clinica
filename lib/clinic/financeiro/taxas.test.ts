import { describe, expect, it } from "vitest";

import { aplicarPercentual, ratear } from "./dinheiro";
import { MODELOS_DE_ADQUIRENTE } from "./modelos";
import {
  calcularRecebimento,
  compararAdquirentes,
  encontrarTaxa,
  ErroDeTaxa,
  precoComMargem,
  precoParaLiquido,
  tabelaVigente,
  type Adquirente,
  type TabelaDeTaxas,
} from "./taxas";

const modelo = (chave: string) => MODELOS_DE_ADQUIRENTE.find((m) => m.chave === chave)!;
const adq = (chave: string, extra: Partial<Adquirente> = {}): Adquirente => ({
  id: chave,
  nome: modelo(chave).nome,
  ...modelo(chave).adquirente,
  ...extra,
});
const tabelas = (chave: string): TabelaDeTaxas[] => [{ vigente_desde: "2026-01-01", linhas: modelo(chave).linhas }];

describe("dinheiro", () => {
  it("percentual meio para cima, em inteiros", () => {
    expect(aplicarPercentual(350000, 11.3)).toBe(39550);
    expect(aplicarPercentual(1, 50)).toBe(1); // 0,5 → 1
    expect(aplicarPercentual(3, 50)).toBe(2); // 1,5 → 2
    expect(aplicarPercentual(9999, 0.57)).toBe(57); // 56,9943 → 57
    expect(aplicarPercentual(0, 10)).toBe(0);
  });
  it("rateio com o resto na 1ª parcela", () => {
    expect(ratear(350000, 6)).toEqual([58335, 58333, 58333, 58333, 58333, 58333]);
    expect(ratear(100, 3)).toEqual([34, 33, 33]);
    expect(ratear(5, 1)).toEqual([5]);
    expect(ratear(2, 3)).toEqual([2, 0, 0]);
  });
});

describe("motor de taxas — o exemplo do pedido", () => {
  const base = {
    adquirente: adq("cielo_smart"),
    tabelas: tabelas("cielo_smart"),
    modalidade: "credito" as const,
    bandeira: null,
    parcelas: 6,
    bruto_cents: 350000,
    data: "2026-03-10",
  };
  it("R$ 3.500 em 6x a 11,30%: taxa R$ 395,50, líquido R$ 3.104,50", () => {
    const r = calcularRecebimento(base);
    expect(r.mdr_cents).toBe(39550);
    expect(r.liquido_cents).toBe(310450);
    expect(r.parcelas).toHaveLength(6);
    expect(r.parcelas.reduce((s, p) => s + p.bruto_cents, 0)).toBe(350000);
    expect(r.parcelas.reduce((s, p) => s + p.mdr_cents, 0)).toBe(39550);
    expect(r.parcelas.map((p) => p.vencimento)).toEqual([
      "2026-04-09",
      "2026-05-09",
      "2026-06-08",
      "2026-07-08",
      "2026-08-07",
      "2026-09-06",
    ]);
  });
  it("antecipação 'fixa' de 9%: líquido ≈ R$ 2.825 e custo ≈ 19,3% (o cálculo do pedido)", () => {
    const r = calcularRecebimento({
      ...base,
      adquirente: adq("cielo_smart", { antecipacao_pct: 9, antecipacao_modo: "fixa" }),
      antecipar: true,
    });
    // 9% arredondado PARCELA A PARCELA (é o que a adquirente desconta): 27.942,
    // 2 centavos acima de 9% do total — a régua é por parcela, e é a que o banco usa
    expect(r.antecipacao_cents).toBe(27942);
    expect(r.liquido_antecipado_cents).toBe(282508);
    expect(r.custo_total_cents).toBe(67492);
    expect(r.custo_total_pct).toBe(19.28);
  });
  it("antecipação 'por mês' (1,5% a.m., juros simples por parcela): custa menos que 6 × 1,5%", () => {
    const r = calcularRecebimento({
      ...base,
      adquirente: adq("cielo_smart", { antecipacao_pct: 1.5, antecipacao_modo: "por_mes" }),
      antecipar: true,
    });
    // cada parcela paga 1,5% × meses antecipados (1 a 6) → ≈ 5,25% do líquido
    const esperado = r.parcelas.reduce((s, p, i) => s + Math.round((p.liquido_cents * 1.5 * (i + 1)) / 100), 0);
    expect(r.antecipacao_cents).toBe(esperado);
    expect(r.antecipacao_cents).toBeGreaterThan(16000);
    expect(r.antecipacao_cents).toBeLessThan(16500);
  });
});

describe("motor de taxas — faixas, bandeira e tarifa", () => {
  const ton = { adquirente: adq("ton"), tabelas: tabelas("ton"), bandeira: null, data: "2026-05-01" };
  it.each([
    ["debito", 1, 0.57],
    ["credito", 1, 0.57],
    ["credito", 2, 3.97],
    ["credito", 3, 3.97],
    ["credito", 4, 4.97],
    ["credito", 7, 7.97],
    ["credito", 12, 7.97],
    ["credito", 13, 14.87],
    ["credito", 21, 14.87],
  ] as const)("Ton %s %ix = %s%%", (modalidade, parcelas, mdr) => {
    const r = calcularRecebimento({ ...ton, modalidade, parcelas, bruto_cents: 100000 });
    expect(r.mdr_pct).toBe(mdr);
    expect(r.mdr_cents).toBe(aplicarPercentual(100000, mdr));
  });
  it("faixa que a tabela não cobre → fin_taxa_ausente", () => {
    expect(() =>
      calcularRecebimento({ ...ton, modalidade: "credito", parcelas: 22, bruto_cents: 100000 }),
    ).toThrow(ErroDeTaxa);
    expect(() =>
      calcularRecebimento({ ...ton, modalidade: "pix", parcelas: 1, bruto_cents: 100000 }),
    ).toThrow("fin_taxa_ausente");
  });
  it("débito e Pix só em 1x", () => {
    expect(() =>
      calcularRecebimento({ ...ton, modalidade: "debito", parcelas: 2, bruto_cents: 100000 }),
    ).toThrow("fin_parcelas_invalidas");
  });
  it("bandeira específica vence a genérica; sem a específica vale a genérica", () => {
    const linhas = [
      { bandeira: null, modalidade: "credito" as const, parcelas_de: 1, parcelas_ate: 12, mdr_pct: 5 },
      { bandeira: "amex" as const, modalidade: "credito" as const, parcelas_de: 1, parcelas_ate: 12, mdr_pct: 6 },
      { bandeira: null, modalidade: "credito" as const, parcelas_de: 2, parcelas_ate: 2, mdr_pct: 4 },
    ];
    expect(encontrarTaxa(linhas, "credito", "amex", 3)?.mdr_pct).toBe(6);
    expect(encontrarTaxa(linhas, "credito", "visa", 3)?.mdr_pct).toBe(5);
    // faixa mais estreita vence
    expect(encontrarTaxa(linhas, "credito", "visa", 2)?.mdr_pct).toBe(4);
  });
  it("tarifa fixa cai só na 1ª parcela", () => {
    const r = calcularRecebimento({
      ...ton,
      adquirente: adq("ton", { tarifa_fixa_cents: 49 }),
      modalidade: "credito",
      parcelas: 3,
      bruto_cents: 30000,
    });
    expect(r.taxa_cents).toBe(r.mdr_cents + 49);
    expect(r.parcelas.map((p) => p.tarifa_cents)).toEqual([49, 0, 0]);
    expect(r.liquido_cents).toBe(30000 - r.taxa_cents);
  });
  it("taxa maior que o valor é recusada", () => {
    expect(() =>
      calcularRecebimento({
        ...ton,
        adquirente: adq("ton", { tarifa_fixa_cents: 500 }),
        modalidade: "debito",
        parcelas: 1,
        bruto_cents: 100,
      }),
    ).toThrow("fin_taxa_maior_que_valor");
  });
  it("prazos: Pix e débito pelo prazo da adquirente", () => {
    const a = adq("cielo_smart", { prazo_pix_dias: 0, prazo_debito_dias: 2 });
    const pix = calcularRecebimento({ adquirente: a, tabelas: tabelas("cielo_smart"), bandeira: null, data: "2026-05-01", modalidade: "pix", parcelas: 1, bruto_cents: 1000 });
    const deb = calcularRecebimento({ adquirente: a, tabelas: tabelas("cielo_smart"), bandeira: null, data: "2026-05-01", modalidade: "debito", parcelas: 1, bruto_cents: 1000 });
    expect(pix.parcelas[0]?.vencimento).toBe("2026-05-01");
    expect(deb.parcelas[0]?.vencimento).toBe("2026-05-03");
  });
});

describe("vigência: editar a taxa não muda o passado", () => {
  const t: TabelaDeTaxas[] = [
    { vigente_desde: "2026-01-01", linhas: [{ bandeira: null, modalidade: "debito", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 1 }] },
    { vigente_desde: "2026-06-01", linhas: [{ bandeira: null, modalidade: "debito", parcelas_de: 1, parcelas_ate: 1, mdr_pct: 2 }] },
  ];
  it("cada data usa a tabela vigente nela", () => {
    expect(tabelaVigente(t, "2025-12-31")).toBeNull();
    expect(tabelaVigente(t, "2026-05-31")?.vigente_desde).toBe("2026-01-01");
    expect(tabelaVigente(t, "2026-06-01")?.vigente_desde).toBe("2026-06-01");
    const antes = calcularRecebimento({ adquirente: adq("ton"), tabelas: t, bandeira: null, modalidade: "debito", parcelas: 1, bruto_cents: 10000, data: "2026-05-31" });
    expect(antes.mdr_cents).toBe(100);
  });
});

describe("ferramentas", () => {
  it("preço com margem: o menor preço que mantém a margem depois da taxa", () => {
    const p = precoComMargem({ custo_cents: 100000, margem_pct: 30, mdr_pct: 11.3, tarifa_cents: 0 })!;
    const sobra = (x: number) => x - aplicarPercentual(x, 11.3) - 100000;
    expect(sobra(p) * 100).toBeGreaterThanOrEqual(30 * p);
    expect(sobra(p - 1) * 100).toBeLessThan(30 * (p - 1));
    expect(precoComMargem({ custo_cents: 1, margem_pct: 95, mdr_pct: 10, tarifa_cents: 0 })).toBeNull();
  });
  it("preço para receber um líquido: embute a taxa do parcelado", () => {
    const p = precoParaLiquido({ liquido_cents: 310450, mdr_pct: 11.3, tarifa_cents: 0 })!;
    expect(p).toBe(350000);
  });
  it("comparativo: mais barata primeiro; quem não cobre a modalidade vai para o fim", () => {
    const mix = [
      { modalidade: "credito" as const, parcelas: 1, bandeira: null, valor_cents: 500000 },
      { modalidade: "credito" as const, parcelas: 6, bandeira: null, valor_cents: 300000 },
      { modalidade: "debito" as const, parcelas: 1, bandeira: null, valor_cents: 200000 },
    ];
    const r = compararAdquirentes(
      mix,
      ["ton", "cielo_smart", "mercado_pago"].map((c) => ({ adquirente: adq(c), tabelas: tabelas(c) })),
      "2026-05-01",
    );
    expect(r[0]?.adquirente_id).toBe("ton");
    expect(r[0]?.sem_taxa).toEqual([]);
    expect(r.at(-1)?.adquirente_id).toBe("mercado_pago");
    expect(r.at(-1)?.sem_taxa.length).toBe(3);
  });
});
