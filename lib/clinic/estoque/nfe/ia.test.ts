import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolver: vi.fn(), gerar: vi.fn(), orcamento: vi.fn(), inserir: vi.fn() }));
vi.mock("@/lib/ai/gateway-binding", () => ({ resolverModeloDoPonto: mocks.resolver }));
vi.mock("ai", () => ({ generateObject: mocks.gerar }));
vi.mock("@/lib/ai/budget/check", () => ({ getBudgetStatus: mocks.orcamento }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: mocks.inserir }) }),
}));

import { aceitarSugestoes, orcamentoEsgotado, PONTO_DEPARA_NFE, sugerirComIa } from "./ia";

const LIVRE = { enforcement_mode: "bloquear", monthly_limit_cents: 1000, current_month_consumed_cents: 10 };
const BINDING = { model: "modelo-falso", modelId: "llama-3.3-70b-versatile", origem: "binding" };

const itens = [
  { numero: 1, descricao: "TOXINA FICTICIA 100U", codigo: "T1", ean: null, unidade: "FR" },
  { numero: 2, descricao: "GAZE FICTICIA", codigo: "G1", ean: null, unidade: "PCT" },
];
const produtos = [
  { id: "p-tox", nome: "Toxina fictícia" },
  { id: "p-gaze", nome: "Gaze fictícia" },
];

beforeEach(() => {
  mocks.resolver.mockReset();
  mocks.gerar.mockReset();
  mocks.orcamento.mockReset().mockResolvedValue(LIVRE);
  mocks.inserir.mockReset().mockResolvedValue({ error: null });
});

describe("aceitarSugestoes", () => {
  it("só ids da lista, só itens enviados, só com confiança alta", () => {
    const r = aceitarSugestoes(
      {
        sugestoes: [
          { numero: 1, product_id: "p-tox", confianca: 0.9 },
          { numero: 2, product_id: "p-gaze", confianca: 0.3 },
          { numero: 3, product_id: "p-tox", confianca: 0.99 },
          { numero: 1, product_id: "inventado", confianca: 1 },
        ],
      },
      itens,
      produtos,
    );
    expect([...r.entries()]).toEqual([[1, "p-tox"]]);
  });
});

describe("sugerirComIa", () => {
  it("usa o modelo do painel para o ponto da NF-e e não manda nada além da nota e do catálogo", async () => {
    mocks.resolver.mockResolvedValue(BINDING);
    mocks.gerar.mockResolvedValue({
      object: { sugestoes: [{ numero: 2, product_id: "p-gaze", confianca: 0.8 }] },
      usage: { inputTokens: 100, outputTokens: 20 },
    });
    const r = await sugerirComIa("org-1", itens, produtos);
    expect(mocks.resolver).toHaveBeenCalledWith(PONTO_DEPARA_NFE, "org-1", expect.any(String));
    const enviado = JSON.parse(mocks.gerar.mock.calls[0]![0].prompt as string) as Record<string, unknown>;
    expect(Object.keys(enviado).sort()).toEqual(["itens", "produtos"]);
    expect([...r.entries()]).toEqual([[2, "p-gaze"]]);
    // o uso fica registrado para o consumo e o orçamento de IA
    expect(mocks.inserir).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: "org-1", purpose: PONTO_DEPARA_NFE, input_tokens: 100, status: "ok" }),
    );
  });

  it("nasce desligado: sem modelo escolhido para o ponto, não chama a IA", async () => {
    mocks.resolver.mockResolvedValue({ ...BINDING, origem: "padrao" });
    expect((await sugerirComIa("org-1", itens, produtos)).size).toBe(0);
    mocks.resolver.mockResolvedValue({ ...BINDING, origem: "credencial_da_organizacao" });
    expect((await sugerirComIa("org-1", itens, produtos)).size).toBe(0);
    expect(mocks.gerar).not.toHaveBeenCalled();
  });

  it("teto de IA atingido no modo bloquear: não chama a IA", async () => {
    mocks.resolver.mockResolvedValue(BINDING);
    mocks.orcamento.mockResolvedValue({ ...LIVRE, current_month_consumed_cents: 1000 });
    expect((await sugerirComIa("org-1", itens, produtos)).size).toBe(0);
    expect(mocks.gerar).not.toHaveBeenCalled();
    expect(orcamentoEsgotado({ ...LIVRE, enforcement_mode: "avisar", current_month_consumed_cents: 5000 })).toBe(false);
  });

  it("sem modelo ou com erro: segue sem sugestão", async () => {
    mocks.resolver.mockResolvedValue(null);
    expect((await sugerirComIa("org-1", itens, produtos)).size).toBe(0);
    mocks.resolver.mockResolvedValue(BINDING);
    mocks.gerar.mockRejectedValue(new Error("tempo esgotado"));
    expect((await sugerirComIa("org-1", itens, produtos)).size).toBe(0);
    expect(mocks.gerar).toHaveBeenCalledTimes(1);
    expect(mocks.inserir).toHaveBeenCalledWith(expect.objectContaining({ status: "erro" }));
  });
});
