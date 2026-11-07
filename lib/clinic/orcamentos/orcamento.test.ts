import { describe, expect, it } from "vitest";

import {
  calcularCondicao,
  criarOrcamentoSchema,
  descontoPrecisaAprovar,
  editarOrcamentoSchema,
  ErroDaCondicao,
  percentualDoDesconto,
  rotuloDoNumero,
} from "./orcamento";

const P = "11111111-1111-4111-8111-111111111111";

describe("calcularCondicao (espelho de fn_clinic_orcamento_condicao)", () => {
  it("à vista: 1 parcela com o total", () => {
    expect(calcularCondicao({ forma: "pix", parcelas: 1 }, 150000)).toEqual({
      forma: "pix",
      parcelas: 1,
      valor_parcela_cents: 150000,
      primeira_parcela_cents: 150000,
    });
  });

  it("parcelado com entrada: o centavo que sobra vai na 1ª (o mesmo caso do invariante)", () => {
    const c = calcularCondicao({ forma: "parcelado", parcelas: 7, entrada: { valor_cents: 20000, forma: "dinheiro" } }, 119999);
    expect(c.valor_parcela_cents).toBe(14285);
    expect(c.primeira_parcela_cents).toBe(14289);
    expect(c.entrada).toEqual({ valor_cents: 20000, forma: "dinheiro" });
    expect(20000 + c.primeira_parcela_cents + c.valor_parcela_cents * 6).toBe(119999);
  });

  it("recusa o que o banco recusa", () => {
    expect(() => calcularCondicao({ forma: "pix", parcelas: 3 }, 100)).toThrow(ErroDaCondicao);
    expect(() => calcularCondicao({ forma: "debito", parcelas: 1, entrada: { valor_cents: 10, forma: "pix" } }, 100)).toThrow(ErroDaCondicao);
    expect(() => calcularCondicao({ forma: "parcelado", parcelas: 1 }, 100)).toThrow(ErroDaCondicao);
    expect(() => calcularCondicao({ forma: "parcelado", parcelas: 25 }, 100)).toThrow(ErroDaCondicao);
    expect(() => calcularCondicao({ forma: "parcelado", parcelas: 2, entrada: { valor_cents: 100, forma: "pix" } }, 100)).toThrow(
      ErroDaCondicao,
    );
  });
});

describe("desconto", () => {
  it("percentual e limite (estritamente maior pede aprovação)", () => {
    expect(percentualDoDesconto(24000, 120000)).toBe(20);
    expect(percentualDoDesconto(10, 0)).toBe(0);
    expect(descontoPrecisaAprovar(12000, 120000, 10)).toBe(false);
    expect(descontoPrecisaAprovar(12001, 120000, 10)).toBe(true);
    expect(descontoPrecisaAprovar(0, 120000, 0)).toBe(false);
  });
});

describe("o que a rota aceita", () => {
  const base = { contact_id: P, itens: [{ preco_id: P }], condicao_pagamento: { forma: "pix" } };

  it("cria com os padrões", () => {
    const r = criarOrcamentoSchema.safeParse(base);
    expect(r.success && r.data).toEqual({
      contact_id: P,
      itens: [{ preco_id: P, quantidade: 1 }],
      desconto_cents: 0,
      condicao_pagamento: { forma: "pix", parcelas: 1 },
    });
  });

  it("não aceita preço no item, organização, forma fora das 5 nem boleto", () => {
    expect(criarOrcamentoSchema.safeParse({ ...base, itens: [{ preco_id: P, preco_cents: 1 }] }).success).toBe(false);
    expect(criarOrcamentoSchema.safeParse({ ...base, organization_id: P }).success).toBe(false);
    expect(criarOrcamentoSchema.safeParse({ ...base, condicao_pagamento: { forma: "boleto" } }).success).toBe(false);
    expect(criarOrcamentoSchema.safeParse({ ...base, condicao_pagamento: { forma: "parcelado", parcelas: 1 } }).success).toBe(false);
    expect(criarOrcamentoSchema.safeParse({ ...base, itens: [] }).success).toBe(false);
  });

  it("a edição não troca o paciente", () => {
    expect(editarOrcamentoSchema.safeParse(base).success).toBe(false);
    const { contact_id: _c, ...semPaciente } = base;
    expect(editarOrcamentoSchema.safeParse(semPaciente).success).toBe(true);
  });

  it("rótulo do número", () => {
    expect(rotuloDoNumero({ numero: 12, versao: 1 })).toBe("Nº 12");
    expect(rotuloDoNumero({ numero: 12, versao: 2 })).toBe("Nº 12 v2");
  });
});
