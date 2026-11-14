/**
 * FORK (card #159): a régua do plano de cobrança é a mesma dos CHECKs da 8026.
 */
import { describe, expect, it } from "vitest";

import { edicaoDoPlanoSchema, novoPlanoSchema } from "./cobranca-plano";

const BASE = { nome: "Standard", preco_cents: 12900, intervalo: "mes", trial_dias: 14 };

describe("novoPlanoSchema", () => {
  it("aceita o plano de referência, com ou sem limites", () => {
    expect(novoPlanoSchema.safeParse(BASE).success).toBe(true);
    expect(
      novoPlanoSchema.safeParse({ ...BASE, max_assentos: 5, max_canais: 1, teto_ia_usd_cents: null }).success,
    ).toBe(true);
  });

  it.each([
    ["preço abaixo de R$ 5", { ...BASE, preco_cents: 499 }],
    ["preço fracionado", { ...BASE, preco_cents: 129.5 }],
    ["teste grátis acima de 90 dias", { ...BASE, trial_dias: 91 }],
    ["teste grátis negativo", { ...BASE, trial_dias: -1 }],
    ["intervalo fora do vocabulário", { ...BASE, intervalo: "semana" }],
    ["teto de IA abaixo de US$ 1", { ...BASE, teto_ia_usd_cents: 99 }],
    ["limite de pessoas zero", { ...BASE, max_assentos: 0 }],
    ["moeda (só BRL, fixada no banco)", { ...BASE, moeda: "USD" }],
    ["nome em branco", { ...BASE, nome: "   " }],
    ["campo desconhecido (organization_id)", { ...BASE, organization_id: "x" }],
  ])("recusa %s", (_caso, corpo) => {
    expect(novoPlanoSchema.safeParse(corpo).success).toBe(false);
  });
});

describe("edicaoDoPlanoSchema", () => {
  it("aceita mudança parcial e o arquivamento", () => {
    expect(edicaoDoPlanoSchema.safeParse({ nome: "Premium" }).success).toBe(true);
    expect(edicaoDoPlanoSchema.safeParse({ arquivado: true }).success).toBe(true);
    expect(edicaoDoPlanoSchema.safeParse({ padrao_no_cadastro: false }).success).toBe(true);
  });

  it("recusa corpo vazio e valor fora da régua", () => {
    expect(edicaoDoPlanoSchema.safeParse({}).success).toBe(false);
    expect(edicaoDoPlanoSchema.safeParse({ preco_cents: 100 }).success).toBe(false);
  });
});
