import { describe, expect, it } from "vitest";

import { marcadoresDoOrcamento, renderizarContrato, type OrcamentoDoContrato } from "./contrato";

const nb = (s: string) => s.replace(/ /g, " ");

const base: OrcamentoDoContrato = {
  numero: 7,
  versao: 2,
  subtotal_cents: 150000,
  desconto_cents: 10000,
  total_cents: 140000,
  validade_ate: "2026-11-22",
  condicao_pagamento: {
    forma: "parcelado",
    parcelas: 3,
    entrada: { valor_cents: 20000, forma: "dinheiro" },
    valor_parcela_cents: 40000,
    primeira_parcela_cents: 40000,
  },
  clinic_orcamento_itens: [
    {
      id: "b",
      preco_id: "p2",
      procedure_id: "x",
      event_type_id: null,
      descricao: "Limpeza de pele — 10 sessões",
      sessoes: 10,
      quantidade: 1,
      preco_unit_cents: 120000,
      total_cents: 120000,
      posicao: 2,
    },
    {
      id: "a",
      preco_id: "p1",
      procedure_id: "x",
      event_type_id: null,
      descricao: "Limpeza de pele",
      sessoes: 1,
      quantidade: 2,
      preco_unit_cents: 15000,
      total_cents: 30000,
      posicao: 1,
    },
  ],
};

describe("marcadores do orçamento no contrato", () => {
  it("itens na ordem, valores, forma de pagamento, entrada, parcelas e validade", () => {
    const m = marcadoresDoOrcamento(base);
    expect(m["orcamento.numero"]).toBe("Nº 7 v2");
    expect(nb(m["orcamento.itens"]!)).toBe(
      "- 2 × Limpeza de pele: R$ 300,00 (R$ 150,00 cada)\n- Limpeza de pele — 10 sessões: R$ 1.200,00",
    );
    expect(nb(m["orcamento.total"]!)).toBe("R$ 1.400,00");
    expect(m["orcamento.forma_pagamento"]).toBe("Cartão de crédito parcelado");
    expect(nb(m["orcamento.entrada"]!)).toBe("R$ 200,00 em dinheiro");
    expect(nb(m["orcamento.parcelas"]!)).toBe("3 × R$ 400,00 no cartão de crédito");
    expect(nb(m["orcamento.pagamento"]!)).toBe(
      "Total de R$ 1.400,00, com entrada de R$ 200,00 em dinheiro e o restante em 3 × R$ 400,00 no cartão de crédito.",
    );
    expect(m["orcamento.validade"]).toBe("22 de novembro de 2026");
  });

  it("à vista: 'pago à vista via Pix', sem entrada; 1ª parcela diferente aparece", () => {
    const pix = marcadoresDoOrcamento({
      ...base,
      desconto_cents: 0,
      condicao_pagamento: { forma: "pix", parcelas: 1, valor_parcela_cents: 140000, primeira_parcela_cents: 140000 },
    });
    expect(nb(pix["orcamento.pagamento"]!)).toBe("Total de R$ 1.400,00, pago à vista via Pix.");
    expect(pix["orcamento.entrada"]).toBe("sem entrada");
    expect(pix["orcamento.desconto"]).toBe("sem desconto");
    const sobra = marcadoresDoOrcamento({
      ...base,
      condicao_pagamento: { forma: "parcelado", parcelas: 3, valor_parcela_cents: 46666, primeira_parcela_cents: 46668 },
    });
    expect(nb(sobra["orcamento.parcelas"]!)).toBe("3 × R$ 466,66 no cartão de crédito (1ª parcela de R$ 466,68)");
  });
});

describe("renderizarContrato", () => {
  const termo = { "paciente.nome": "Paciente Fictícia", "clinica.nome": "Clínica Teste" };

  it("modelo com os marcadores: sem anexo", () => {
    const t = nb(renderizarContrato("Contratante: {{paciente.nome}}.\n{{orcamento.itens}}\n{{orcamento.pagamento}}", termo, base));
    expect(t).toContain("Contratante: Paciente Fictícia.");
    expect(t).toContain("- 2 × Limpeza de pele");
    expect(t).not.toContain("ANEXO");
  });

  it("modelo antigo sem os marcadores: ganha o anexo com itens e forma de pagamento", () => {
    const t = nb(renderizarContrato("# Contrato\n\nContratada: {{clinica.nome}}.", termo, base));
    expect(t).toContain("Contratada: Clínica Teste.");
    expect(t).toContain("ANEXO — ORÇAMENTO Nº 7 v2");
    expect(t).toContain("Forma de pagamento: Cartão de crédito parcelado");
    expect(t).toContain("Parcelas: 3 × R$ 400,00 no cartão de crédito");
    expect(t).toContain("Proposta válida até 22 de novembro de 2026.");
    expect(t).not.toContain("Observação do pagamento");
    const comObs = nb(
      renderizarContrato("Contrato.", termo, {
        ...base,
        condicao_pagamento: { ...base.condicao_pagamento, observacao: "Primeira parcela em 30 dias" },
      }),
    );
    expect(comObs).toContain("Observação do pagamento: Primeira parcela em 30 dias");
  });
});
