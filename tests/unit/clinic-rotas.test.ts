/**
 * Rotas do módulo clinic (fork): as recusas que NÃO dependem da RLS e a forma
 * do que é gravado. A RLS em si é provada no Postgres real, em
 * tests/invariants/clinic-profissionais-rls.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(async () => undefined),
  isServiceRoleConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/impersonate/support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/impersonate/support")>()),
  requireSupportWrite: vi.fn(async () => null),
}));

const ORG = "22222222-2222-4222-8222-222222222222";
const EU = "11111111-1111-4111-8111-111111111111";
const COLEGA = "11111111-1111-4111-8111-222222222222";
const ESP = "33333333-3333-4333-8333-333333333333";
const ESP_OUTRA_ORG = "33333333-3333-4333-8333-444444444444";
const TIPO = "55555555-5555-4555-8555-555555555555";

type Chamada = { tabela: string; op: string; valor?: unknown; filtros: [string, string, unknown][] };
let chamadas: Chamada[] = [];
/** Resposta por `tabela:op`; default: sucesso com linha fictícia. */
let respostas: Record<string, { data: unknown; error: unknown }> = {};

function falsoSupabase() {
  return {
    from(tabela: string) {
      const c: Chamada = { tabela, op: "select", filtros: [] };
      chamadas.push(c);
      const cadeia: Record<string, unknown> = {};
      const encadeia = (nome: string) => (...args: unknown[]) => {
        if (["insert", "upsert", "update", "delete"].includes(nome)) {
          c.op = nome;
          c.valor = args[0];
        } else if (["eq", "in", "gte", "lte", "not", "is"].includes(nome)) {
          c.filtros.push([nome, String(args[0]), args[args.length - 1]]);
        }
        return cadeia;
      };
      for (const m of ["select", "insert", "upsert", "update", "delete", "eq", "in", "gte", "lte", "not", "is", "order", "limit"]) {
        cadeia[m] = encadeia(m);
      }
      const resolver = () => respostas[`${tabela}:${c.op}`] ?? { data: { id: "novo-id" }, error: null };
      cadeia.single = async () => resolver();
      cadeia.maybeSingle = async () => resolver();
      cadeia.then = (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) =>
        Promise.resolve(resolver()).then(ok, erro);
      return cadeia;
    },
    rpc: vi.fn(async () => ({ data: { ligado: true, mudou: true }, error: null })),
  };
}

function autorizado(role: "viewer" | "agent" | "manager" | "admin") {
  vi.mocked(requireRole).mockImplementation(async (min) => {
    const ordem = ["viewer", "agent", "manager", "admin"];
    if (ordem.indexOf(role) < ordem.indexOf(min)) {
      return { ok: false, response: new Response(null, { status: 403 }) } as never;
    }
    return { ok: true, user: { id: EU, idioma: "pt-BR" }, org: { orgId: ORG, name: "Clínica", role } } as never;
  });
}

function pedido(url: string, metodo: string, corpo?: unknown): NextRequest {
  return new NextRequest(`https://crm.exemplo${url}`, {
    method: metodo,
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
}

beforeEach(() => {
  chamadas = [];
  respostas = {};
  vi.mocked(audit).mockClear();
  vi.mocked(createClient).mockResolvedValue(falsoSupabase() as never);
});

describe("POST /api/v1/clinic/bloqueios", () => {
  const rota = () => import("@/app/api/v1/clinic/bloqueios/route");
  const base = { starts_on: "2026-10-05", ends_on: "2026-10-09" };

  it("atendente bloqueia a própria agenda: grava user_id dele", async () => {
    autorizado("agent");
    const res = await (await rota()).POST(pedido("/api/v1/clinic/bloqueios", "POST", base));
    expect(res.status).toBe(201);
    const insert = chamadas.find((c) => c.tabela === "clinic_agenda_blocks" && c.op === "insert");
    expect(insert?.valor).toMatchObject({ organization_id: ORG, user_id: EU, weekdays: null, created_by: EU });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({ action: "clinic.bloqueio_criado" }));
  });

  it("atendente NÃO bloqueia agenda de colega: 403 sem tocar no banco", async () => {
    autorizado("agent");
    const res = await (await rota()).POST(pedido("/api/v1/clinic/bloqueios", "POST", { ...base, user_id: COLEGA }));
    expect(res.status).toBe(403);
    expect(chamadas.some((c) => c.op === "insert")).toBe(false);
  });

  it("atendente NÃO bloqueia a clínica toda: 403", async () => {
    autorizado("agent");
    const res = await (await rota()).POST(pedido("/api/v1/clinic/bloqueios", "POST", { ...base, clinica_toda: true }));
    expect(res.status).toBe(403);
  });

  it("gerente bloqueia a clínica toda: user_id null, recorrência ordenada e sem repetição", async () => {
    autorizado("manager");
    const res = await (await rota()).POST(
      pedido("/api/v1/clinic/bloqueios", "POST", { ...base, clinica_toda: true, weekdays: [5, 1, 5] }),
    );
    expect(res.status).toBe(201);
    const insert = chamadas.find((c) => c.op === "insert");
    expect(insert?.valor).toMatchObject({ user_id: null, weekdays: [1, 5] });
  });

  it.each([
    ["dia da semana 7", { ...base, weekdays: [7] }],
    ["fim antes do começo", { ...base, start_minute: 600, end_minute: 540 }],
    ["data final antes da inicial", { starts_on: "2026-10-09", ends_on: "2026-10-05" }],
    ["período maior que um ano", { starts_on: "2026-01-01", ends_on: "2027-06-01" }],
    ["data em formato errado", { starts_on: "05/10/2026", ends_on: "2026-10-09" }],
  ])("recusa %s com 422", async (_rotulo, corpo) => {
    autorizado("manager");
    const res = await (await rota()).POST(pedido("/api/v1/clinic/bloqueios", "POST", corpo));
    expect(res.status).toBe(422);
    expect(chamadas.some((c) => c.op === "insert")).toBe(false);
  });

  it("viewer não chega a criar", async () => {
    autorizado("viewer");
    const res = await (await rota()).POST(pedido("/api/v1/clinic/bloqueios", "POST", base));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/v1/clinic/profissionais", () => {
  const rota = () => import("@/app/api/v1/clinic/profissionais/route");

  it("recusa especialidade de outra empresa (a RLS não pega referência cruzada)", async () => {
    autorizado("manager");
    respostas["user_organizations:select"] = { data: { user_id: COLEGA }, error: null };
    // Pediu duas, a org só tem uma delas.
    respostas["clinic_specialties:select"] = { data: [{ id: ESP }], error: null };
    const res = await (await rota()).POST(
      pedido("/api/v1/clinic/profissionais", "POST", { user_id: COLEGA, specialty_ids: [ESP, ESP_OUTRA_ORG] }),
    );
    expect(res.status).toBe(422);
    expect(chamadas.some((c) => c.op === "upsert")).toBe(false);
  });

  it("recusa quem não é membro da equipe", async () => {
    autorizado("manager");
    respostas["user_organizations:select"] = { data: null, error: null };
    const res = await (await rota()).POST(pedido("/api/v1/clinic/profissionais", "POST", { user_id: COLEGA }));
    expect(res.status).toBe(422);
  });

  it("atendente não salva ficha", async () => {
    autorizado("agent");
    const res = await (await rota()).POST(pedido("/api/v1/clinic/profissionais", "POST", { user_id: COLEGA }));
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/v1/clinic/tipos/:id/especialidades", () => {
  const rota = () => import("@/app/api/v1/clinic/tipos/[id]/especialidades/route");
  const ctx = { params: Promise.resolve({ id: TIPO }) };

  it("tipo de outra empresa: 404, nada apagado", async () => {
    autorizado("manager");
    respostas["calendar_event_types:select"] = { data: [], error: null };
    const res = await (await rota()).PUT(
      pedido(`/api/v1/clinic/tipos/${TIPO}/especialidades`, "PUT", { specialty_ids: [ESP] }),
      ctx,
    );
    expect(res.status).toBe(404);
    expect(chamadas.some((c) => c.op === "delete")).toBe(false);
  });

  it("substitui a lista, sempre filtrando pela organização", async () => {
    autorizado("manager");
    respostas["calendar_event_types:select"] = { data: [{ id: TIPO }], error: null };
    respostas["clinic_specialties:select"] = { data: [{ id: ESP }], error: null };
    respostas["clinic_event_type_specialties:delete"] = { data: null, error: null };
    respostas["clinic_event_type_specialties:insert"] = { data: null, error: null };
    const res = await (await rota()).PUT(
      pedido(`/api/v1/clinic/tipos/${TIPO}/especialidades`, "PUT", { specialty_ids: [ESP, ESP] }),
      ctx,
    );
    expect(res.status).toBe(200);
    const apagar = chamadas.find((c) => c.op === "delete");
    expect(apagar?.filtros).toContainEqual(["eq", "organization_id", ORG]);
    const inserir = chamadas.find((c) => c.op === "insert");
    expect(inserir?.valor).toEqual([{ organization_id: ORG, event_type_id: TIPO, specialty_id: ESP }]);
  });
});

describe("PATCH /api/v1/clinic/config", () => {
  const rota = () => import("@/app/api/v1/clinic/config/route");

  it("só admin liga o módulo", async () => {
    autorizado("manager");
    const res = await (await rota()).PATCH(pedido("/api/v1/clinic/config", "PATCH", { profissionais: true }));
    expect(res.status).toBe(403);
  });

  it("admin liga e a mudança é auditada", async () => {
    autorizado("admin");
    const res = await (await rota()).PATCH(pedido("/api/v1/clinic/config", "PATCH", { profissionais: true }));
    expect(res.status).toBe(200);
    expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({ action: "clinic.flag_alterada" }));
  });
});
