/**
 * FORK (card #159): as rotas de plano de cobrança — módulo desligado = 404 sem
 * tocar no banco; escrita só de admin de plataforma `full`; preço travado com
 * assinantes; toda mudança auditada.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Resposta = { data?: unknown; error?: { code: string; message: string } | null; count?: number };
interface Cadeia {
  tabela: string;
  chamadas: Array<[string, unknown[]]>;
}

const h = vi.hoisted(() => ({
  ator: "aaaaaaaa-0000-4000-8000-000000000001",
  ligada: true,
  scope: "full",
  audit: vi.fn(),
  cadeias: [] as Cadeia[],
  respostas: [] as Resposta[],
}));

function cliente() {
  return {
    from(tabela: string) {
      const cadeia: Cadeia = { tabela, chamadas: [] };
      h.cadeias.push(cadeia);
      const resolver = () => Promise.resolve({ data: null, error: null, ...(h.respostas.shift() ?? {}) });
      const proxy: Record<string, unknown> = new Proxy(
        {},
        {
          get(_alvo, nome: string) {
            if (nome === "then") return (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => resolver().then(ok, erro);
            if (nome === "single" || nome === "maybeSingle") return () => resolver();
            return (...args: unknown[]) => {
              cadeia.chamadas.push([nome, args]);
              return proxy;
            };
          },
        },
      );
      return proxy;
    },
  };
}

vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: async () => null }));
vi.mock("@/lib/auth/server", () => ({ mfaEmDividaEstrita: async () => false }));
vi.mock("@/lib/auth/requirePlatformAdmin", () => ({
  requirePlatformAdmin: async () => ({
    user: { id: h.ator },
    platformAdmin: { user_id: h.ator, scope: h.scope, mfa_required: false },
  }),
}));
vi.mock("@/lib/instalacao/modulos", () => ({
  moduloLigado: async (_db: unknown, modulo: string) => modulo === "cobranca" && h.ligada,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => cliente() }));
vi.mock("@/lib/audit", () => ({ audit: h.audit }));

import { PATCH } from "./[id]/route";
import { GET, POST } from "./route";

const ID = "cccccccc-0000-4000-8000-000000000001";
const CORPO = { nome: "Standard", preco_cents: 12900, intervalo: "mes", trial_dias: 14, padrao_no_cadastro: true };
const PLANO = { id: ID, ...CORPO, moeda: "BRL", arquivado_em: null };
const pedido = (body: unknown, metodo = "POST") =>
  new NextRequest("http://localhost/api/v1/admin/cobranca/planos", {
    method: metodo,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const params = { params: Promise.resolve({ id: ID }) };
const args = (c: Cadeia, metodo: string) => c.chamadas.find(([n]) => n === metodo)?.[1];

beforeEach(() => {
  vi.clearAllMocks();
  h.ligada = true;
  h.scope = "full";
  h.cadeias = [];
  h.respostas = [];
});

describe("POST /api/v1/admin/cobranca/planos", () => {
  it("cria o plano com quem criou e audita cobranca.plano_salvo", async () => {
    h.respostas.push({ data: PLANO });
    const res = await POST(pedido(CORPO));
    expect(res.status).toBe(201);
    expect(h.cadeias[0]!.tabela).toBe("cobranca_planos");
    expect(args(h.cadeias[0]!, "insert")?.[0]).toEqual({ ...CORPO, updated_by: h.ator });
    expect(h.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cobranca.plano_salvo", actorUserId: h.ator, resourceId: ID }),
    );
  });

  it("módulo desligado → 404 e o banco nem é tocado (GET e POST)", async () => {
    h.ligada = false;
    expect((await POST(pedido(CORPO))).status).toBe(404);
    expect((await GET()).status).toBe(404);
    expect(h.cadeias).toEqual([]);
  });

  it("acesso de suporte (escopo não full) → 403, nada gravado", async () => {
    h.scope = "support_readonly";
    expect((await POST(pedido(CORPO))).status).toBe(403);
    expect(h.cadeias).toEqual([]);
  });

  it("corpo inválido → 400 sem banco e sem audit", async () => {
    expect((await POST(pedido({ ...CORPO, preco_cents: 100 }))).status).toBe(400);
    expect(h.cadeias).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("segundo plano do cadastro → 409 state_conflict", async () => {
    h.respostas.push({ error: { code: "23505", message: "duplicate key" } });
    const res = await POST(pedido(CORPO));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("state_conflict");
    expect(h.audit).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/admin/cobranca/planos/[id]", () => {
  it("preço não muda com assinantes → 409 plano_com_assinantes, sem update", async () => {
    h.respostas.push({ data: { id: ID, preco_cents: 12900, intervalo: "mes", arquivado_em: null } }, { count: 2 });
    const res = await PATCH(pedido({ preco_cents: 15900 }, "PATCH"), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("plano_com_assinantes");
    expect(h.cadeias.some((c) => c.chamadas.some(([n]) => n === "update"))).toBe(false);
  });

  it("arquivar grava arquivado_em, tira do cadastro e audita cobranca.plano_arquivado", async () => {
    h.respostas.push(
      { data: { id: ID, preco_cents: 12900, intervalo: "mes", arquivado_em: null } },
      { data: { ...PLANO, arquivado_em: "2026-11-13T00:00:00Z" } },
    );
    const res = await PATCH(pedido({ arquivado: true }, "PATCH"), params);
    expect(res.status).toBe(200);
    const atualizacao = h.cadeias.find((c) => c.chamadas.some(([n]) => n === "update"))!;
    const linha = args(atualizacao, "update")?.[0] as Record<string, unknown>;
    expect(linha.arquivado_em).toEqual(expect.any(String));
    expect(linha.padrao_no_cadastro).toBe(false);
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "cobranca.plano_arquivado" }));
  });

  it("id que não é uuid → 404 sem banco", async () => {
    const res = await PATCH(pedido({ nome: "x" }, "PATCH"), { params: Promise.resolve({ id: "1,plano_id.neq.0" }) });
    expect(res.status).toBe(404);
    expect(h.cadeias).toEqual([]);
  });
});
