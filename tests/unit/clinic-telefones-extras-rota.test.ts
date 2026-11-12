/**
 * #85 — /api/v1/clinic/pacientes/{id}/telefones: adicionar e remover telefone EXTRA.
 * A regra "um número, uma ficha" é do banco (tests/invariants/ficha-com-varios-telefones);
 * aqui, as recusas da rota e o que ela grava.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { DELETE, POST } from "@/app/api/v1/clinic/pacientes/[contactId]/telefones/route";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { pacienteNoEscopo } from "@/lib/clinic/pacientes/escopo-de-pacientes";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined), isServiceRoleConfigured: vi.fn(() => true) }));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/clinic/pacientes/escopo-de-pacientes", () => ({ pacienteNoEscopo: vi.fn(async () => true) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));

const ORG = "22222222-2222-4222-8222-222222222222";
const EU = "11111111-1111-4111-8111-111111111111";
const PACIENTE = "44444444-4444-4444-8444-444444444444";

let opcaoLigada = true;
let ficha: { id: string; phone_number: string | null } | null = { id: PACIENTE, phone_number: "+5511999998888" };
let erroAoGravar: { code: string; message: string } | null = null;
let removidos: unknown[] = [{ id: "x" }];
let inserido: Record<string, unknown> | null = null;
let filtros: Array<[string, string, unknown]> = [];

function ctx() {
  return { params: Promise.resolve({ contactId: PACIENTE }) };
}
function post(corpo: unknown) {
  return new NextRequest(`http://localhost/api/v1/clinic/pacientes/${PACIENTE}/telefones`, {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  opcaoLigada = true;
  ficha = { id: PACIENTE, phone_number: "+5511999998888" };
  erroAoGravar = null;
  removidos = [{ id: "x" }];
  inserido = null;
  filtros = [];
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: { id: EU, idioma: "pt-BR" },
    org: { orgId: ORG, role: "agent" },
  } as never);
  vi.mocked(createClient).mockResolvedValue({
    from: (tabela: string) => {
      const q: Record<string, unknown> = {};
      const eu = () => q;
      Object.assign(q, {
        select: eu,
        is: eu,
        eq: (c: string, v: unknown) => (filtros.push([tabela, c, v]), q),
        maybeSingle: async () => ({
          data: tabela === "organizations" ? { settings: { clinic: { varios_telefones: opcaoLigada } } } : ficha,
          error: null,
        }),
        insert: (linha: Record<string, unknown>) => {
          inserido = linha;
          return {
            select: () => ({
              single: async () =>
                erroAoGravar
                  ? { data: null, error: erroAoGravar }
                  : { data: { ...linha, created_at: "2026-11-06T10:00:00Z" }, error: null },
            }),
          };
        },
        delete: () => {
          const d: Record<string, unknown> = {};
          Object.assign(d, {
            eq: (c: string, v: unknown) => (filtros.push([tabela, c, v]), d),
            select: async () => ({ data: removidos, error: null }),
          });
          return d;
        },
      });
      return q;
    },
  } as never);
});

describe("POST telefone extra", () => {
  it("⭐ grava na forma canônica, na organização da SESSÃO, com origem manual", async () => {
    const res = await POST(post({ phone_number: "(11) 98888-7777", type: "celular", whatsapp: "sim", label: "Trabalho" }), ctx());
    expect(res.status).toBe(201);
    expect(inserido).toMatchObject({
      organization_id: ORG,
      contact_id: PACIENTE,
      phone_number: "+5511988887777",
      tipo: "celular",
      whatsapp: "sim",
      rotulo: "Trabalho",
      origem: "manual",
    });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({ action: "clinic.paciente.telefone_extra" }));
  });

  it("⭐ opção desligada → 403 e nada gravado", async () => {
    opcaoLigada = false;
    const res = await POST(post({ phone_number: "11988887777", type: "celular" }), ctx());
    expect(res.status).toBe(403);
    expect(inserido).toBeNull();
  });

  it("⭐ número de outra ficha (23505 do banco) → 409", async () => {
    erroAoGravar = { code: "23505", message: "telefone_de_outra_ficha" };
    const res = await POST(post({ phone_number: "11988887777", type: "celular" }), ctx());
    expect(res.status).toBe(409);
  });

  it("o próprio principal não vira extra (409 sem ir ao banco)", async () => {
    const res = await POST(post({ phone_number: "11 99999-8888", type: "celular" }), ctx());
    expect(res.status).toBe(409);
    expect(inserido).toBeNull();
  });

  it("organização no corpo é recusada (422)", async () => {
    const res = await POST(post({ phone_number: "11988887777", type: "celular", organization_id: ORG }), ctx());
    expect(res.status).toBe(422);
  });

  it("fora do escopo de pacientes → 404", async () => {
    vi.mocked(pacienteNoEscopo).mockResolvedValueOnce(false);
    const res = await POST(post({ phone_number: "11988887777", type: "celular" }), ctx());
    expect(res.status).toBe(404);
  });
});

describe("DELETE telefone extra", () => {
  it("⭐ remove só o extra desta ficha desta organização", async () => {
    const req = new NextRequest(`http://localhost/x?telefone=${encodeURIComponent("+5511988887777")}`, { method: "DELETE" });
    const res = await DELETE(req, ctx());
    expect(res.status).toBe(200);
    expect(filtros).toEqual(
      expect.arrayContaining([
        ["contact_phones", "organization_id", ORG],
        ["contact_phones", "contact_id", PACIENTE],
        ["contact_phones", "phone_number", "+5511988887777"],
      ]),
    );
  });

  it("número que não é extra da ficha → 404", async () => {
    removidos = [];
    const req = new NextRequest(`http://localhost/x?telefone=11988887777`, { method: "DELETE" });
    expect((await DELETE(req, ctx())).status).toBe(404);
  });
});
