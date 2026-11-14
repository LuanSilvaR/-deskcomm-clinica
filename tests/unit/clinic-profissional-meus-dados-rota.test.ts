/**
 * #97 — /api/v1/clinic/profissionais/eu: o profissional grava só o PRÓPRIO
 * registro no conselho. Aqui, as recusas da rota e o que ela manda ao banco; a
 * barreira no Postgres (só a linha de auth.uid()) é provada em
 * tests/invariants/clinic-profissional-proprio-registro.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, PATCH } from "@/app/api/v1/clinic/profissionais/eu/route";
import { fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined), isServiceRoleConfigured: vi.fn(() => true) }));
vi.mock("@/lib/clinic/acesso/require-permission", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/impersonate/support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/impersonate/support")>()),
  requireSupportWrite: vi.fn(async () => null),
}));

const ORG = "22222222-2222-4222-8222-222222222222";
const OUTRA_ORG = "33333333-3333-4333-8333-333333333333";
const EU = "11111111-1111-4111-8111-111111111111";
const COLEGA = "44444444-4444-4444-8444-444444444444";

const FICHA = {
  id: "55555555-5555-4555-8555-555555555555",
  user_id: EU,
  display_name: null,
  council: "CRM",
  council_number: "1234",
  council_uf: "SP",
  is_active: true,
  clinic_professional_specialties: [{ clinic_specialties: { name: "Toxina" } }, { clinic_specialties: { name: "Laser" } }],
};

let rpc: ReturnType<typeof vi.fn>;
let filtros: [string, unknown][] = [];
let fichaNoBanco: unknown = FICHA;

function patch(corpo: unknown) {
  return new NextRequest("http://localhost/api/v1/clinic/profissionais/eu", {
    method: "PATCH",
    body: JSON.stringify(corpo),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  filtros = [];
  fichaNoBanco = FICHA;
  rpc = vi.fn(async () => ({ data: { id: FICHA.id }, error: null }));
  vi.mocked(requirePermission).mockResolvedValue({
    ok: true,
    user: { id: EU, idioma: "pt-BR" },
    org: { orgId: ORG, role: "agent" },
    permissoes: new Set(["agenda.bloquear_horario"]),
  } as never);
  vi.mocked(createClient).mockResolvedValue({
    rpc,
    from: () => {
      const cadeia = {
        select: () => cadeia,
        eq: (coluna: string, valor: unknown) => {
          filtros.push([coluna, valor]);
          return cadeia;
        },
        maybeSingle: async () => ({ data: fichaNoBanco, error: null }),
      };
      return cadeia;
    },
  } as never);
});

describe("PATCH /api/v1/clinic/profissionais/eu", () => {
  it("⭐ grava o próprio registro: a empresa vem da sessão, nunca do corpo", async () => {
    const res = await PATCH(patch({ council: "CRO", council_number: " 777 ", council_uf: "rj" }));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("fn_clinic_salvar_meu_registro", {
      p_org: ORG,
      p_council: "CRO",
      p_council_number: "777",
      p_council_uf: "RJ",
    });
    expect(filtros).toContainEqual(["user_id", EU]);
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "clinic.profissional.proprios_dados", actorUserId: EU, organizationId: ORG }),
    );
    const corpo = (await res.json()) as { data: { especialidades: string[] } };
    expect(corpo.data.especialidades).toEqual(["Laser", "Toxina"]);
  });

  it.each([
    ["user_id de outro", { user_id: COLEGA, council: "CRM" }],
    ["organização no corpo", { organization_id: OUTRA_ORG, council: "CRM" }],
    ["especialidades", { specialty_ids: [] }],
    ["ativo", { is_active: false }],
  ])("⭐ recusa %s (422) sem chamar o banco", async (_nome, corpo) => {
    const res = await PATCH(patch(corpo));
    expect(res.status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("recusa UF inválida", async () => {
    const res = await PATCH(patch({ council_uf: "São Paulo" }));
    expect(res.status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sem a permissão, a recusa do requirePermission passa direto", async () => {
    vi.mocked(requirePermission).mockResolvedValueOnce({
      ok: false,
      response: fail("forbidden_permission", "sem permissão", 403),
    } as never);
    const res = await PATCH(patch({ council: "CRM" }));
    expect(res.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sem ficha → 404 com o recado para a gerência", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "clinic_ficha_inexistente" } });
    const res = await PATCH(patch({ council: "CRM" }));
    expect(res.status).toBe(404);
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });

  it("recusa do banco (42501) → 403", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "acesso_proibido" } });
    const res = await PATCH(patch({ council: "CRM" }));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/clinic/profissionais/eu", () => {
  it("lê só a ficha de quem está logado", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(filtros).toEqual([
      ["organization_id", ORG],
      ["user_id", EU],
    ]);
  });

  it("sem ficha devolve null", async () => {
    fichaNoBanco = null;
    const res = await GET();
    expect(((await res.json()) as { data: { ficha: unknown } }).data.ficha).toBeNull();
  });
});
