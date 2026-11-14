import { describe, expect, it } from "vitest";

import {
  formatarReais,
  precoPorSessao,
  publicarPrecoSchema,
  reaisParaCentavos,
  tabelaVigente,
  type LinhaDePreco,
} from "./precos";

const P1 = "11111111-1111-4111-8111-111111111111";
const S1 = "22222222-2222-4222-8222-222222222222";

let seq = 0;
const linha = (over: Partial<LinhaDePreco>): LinhaDePreco => {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    procedure_id: P1,
    event_type_id: null,
    sessoes: 1,
    descricao: null,
    preco_cents: 10000,
    ativo: true,
    vigente_desde: "2026-11-01T10:00:00.000Z",
    created_at: "2026-11-01T10:00:00.000Z",
    ...over,
  };
};
const AGORA = "2026-11-07T12:00:00.000Z";

describe("tabelaVigente", () => {
  it("vale a vigência mais nova já iniciada; as anteriores vão para o histórico", () => {
    const itens = tabelaVigente(
      [
        linha({ preco_cents: 10000, vigente_desde: "2026-10-01T10:00:00.000Z" }),
        linha({ preco_cents: 15000, vigente_desde: "2026-11-05T10:00:00.000Z" }),
        linha({ preco_cents: 12000, vigente_desde: "2026-10-20T10:00:00.000Z" }),
      ],
      AGORA,
    );
    expect(itens).toHaveLength(1);
    expect(itens[0]?.preco_cents).toBe(15000);
    expect(itens[0]?.historico.map((h) => h.preco_cents)).toEqual([12000, 10000]);
  });

  it("vigência futura ainda não vale", () => {
    const itens = tabelaVigente(
      [linha({ preco_cents: 10000 }), linha({ preco_cents: 99000, vigente_desde: "2026-12-01T00:00:00.000Z" })],
      AGORA,
    );
    expect(itens[0]?.preco_cents).toBe(10000);
    expect(itens[0]?.historico).toEqual([]);
  });

  it("empate de vigência: a criada por último vence", () => {
    const itens = tabelaVigente(
      [
        linha({ preco_cents: 1, created_at: "2026-11-01T10:00:00.000Z" }),
        linha({ preco_cents: 2, created_at: "2026-11-01T10:00:01.000Z" }),
      ],
      AGORA,
    );
    expect(itens[0]?.preco_cents).toBe(2);
  });

  it("item cuja vigência mais nova está inativa sai da tabela", () => {
    const itens = tabelaVigente(
      [linha({ preco_cents: 10000 }), linha({ ativo: false, vigente_desde: "2026-11-02T10:00:00.000Z" })],
      AGORA,
    );
    expect(itens).toEqual([]);
  });

  it("avulso, pacote e tipo de serviço são itens diferentes", () => {
    const itens = tabelaVigente(
      [
        linha({ sessoes: 1, preco_cents: 20000 }),
        linha({ sessoes: 10, preco_cents: 150000 }),
        linha({ procedure_id: null, event_type_id: S1, preco_cents: 8000 }),
      ],
      AGORA,
    );
    expect(itens.map((i) => [i.tipo, i.sessoes, i.preco_cents]).sort()).toEqual(
      [
        ["procedimento", 1, 20000],
        ["procedimento", 10, 150000],
        ["servico", 1, 8000],
      ].sort(),
    );
  });
});

describe("dinheiro", () => {
  it("formata em reais", () => {
    expect(formatarReais(150000).replace(/\s/g, " ")).toBe("R$ 1.500,00");
  });

  it("lê o que a recepção digita", () => {
    expect(reaisParaCentavos("150")).toBe(15000);
    expect(reaisParaCentavos("150,5")).toBe(15050);
    expect(reaisParaCentavos("1.500,00")).toBe(150000);
    expect(reaisParaCentavos("R$ 89,90")).toBe(8990);
    expect(reaisParaCentavos("12,345")).toBeNull();
    expect(reaisParaCentavos("abc")).toBeNull();
    expect(reaisParaCentavos("")).toBeNull();
    expect(reaisParaCentavos("-10")).toBeNull();
  });

  it("preço por sessão do pacote, em centavos inteiros", () => {
    expect(precoPorSessao({ preco_cents: 100000, sessoes: 3 })).toBe(33333);
    expect(precoPorSessao({ preco_cents: 15000, sessoes: 1 })).toBe(15000);
  });
});

describe("publicarPrecoSchema", () => {
  it("exige exatamente um item", () => {
    expect(publicarPrecoSchema.safeParse({ preco_cents: 100 }).success).toBe(false);
    expect(publicarPrecoSchema.safeParse({ procedure_id: P1, event_type_id: S1, preco_cents: 100 }).success).toBe(false);
    const ok = publicarPrecoSchema.safeParse({ procedure_id: P1, preco_cents: 100 });
    expect(ok.success && ok.data).toEqual({ procedure_id: P1, preco_cents: 100, sessoes: 1, ativo: true });
  });

  it("recusa valor fora dos limites e campo desconhecido (organização nunca vem do corpo)", () => {
    expect(publicarPrecoSchema.safeParse({ procedure_id: P1, preco_cents: -1 }).success).toBe(false);
    expect(publicarPrecoSchema.safeParse({ procedure_id: P1, preco_cents: 1.5 }).success).toBe(false);
    expect(publicarPrecoSchema.safeParse({ procedure_id: P1, preco_cents: 100, sessoes: 0 }).success).toBe(false);
    expect(publicarPrecoSchema.safeParse({ procedure_id: P1, preco_cents: 100, organization_id: P1 }).success).toBe(false);
  });
});
