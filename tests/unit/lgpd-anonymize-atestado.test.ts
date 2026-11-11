/**
 * Anonimização emite o atestado (#87) só com a chave ligada; a chave aparece
 * em GET/PATCH /api/v1/clinic/config.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { emitirAtestado } from "@/lib/clinic/lgpd/emitir-atestado";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/clinic/lgpd/emitir-atestado", () => ({ emitirAtestado: vi.fn() }));
vi.mock("@/lib/lgpd/cascata", () => ({
  completarRedacaoDoContato: vi.fn(async () => ({ falhas: [], tabelas: [], leadsRedigidas: [], atividadesRedigidas: [] })),
  houveRedacao: vi.fn(() => false),
}));
vi.mock("@/lib/impersonate/support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/impersonate/support")>()),
  requireSupportWrite: vi.fn(async () => null),
}));

const ORG = "22222222-2222-4222-8222-222222222222";
const USER = "11111111-1111-4111-8111-111111111111";
const CONTATO = "33333333-3333-4333-8333-333333333333";
const QUANDO = "2026-09-06T12:00:00.000Z";
const ATESTADO = { id: "at-1", codigo_curto: "ABCD-1234", algoritmo: "hmac-sha256" as const, emitido_em: QUANDO };

let tabelasLidasNoAdmin: string[];

function prepara(opts: { flag: boolean; jaAnonimizado?: boolean; linhaExistente?: unknown }) {
  tabelasLidasNoAdmin = [];
  const rls = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: CONTATO, organization_id: ORG, is_anonymized: !!opts.jaAnonimizado, anonymized_at: null },
            error: null,
          }),
        }),
      }),
    }),
    rpc: vi.fn(async (nome: string) =>
      nome === "fn_lgpd_anonymize_contact"
        ? { data: { already_anonymized: !!opts.jaAnonimizado, anonymized_at: QUANDO }, error: null }
        : { error: null },
    ),
    auth: { getUser: async () => ({ data: { user: { id: USER } }, error: null }) },
  };
  vi.mocked(createClient).mockResolvedValue(rls as never);
  const admin = {
    from: (tabela: string) => {
      tabelasLidasNoAdmin.push(tabela);
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () =>
          tabela === "organizations"
            ? { data: { settings: { clinic: { atestado_anonimizacao: opts.flag } } }, error: null }
            : { data: opts.linhaExistente ?? null, error: null },
      };
      return q;
    },
  };
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: { id: USER, email: "ana@exemplo.test", full_name: "Ana Teste", idioma: "pt-BR" },
    org: { orgId: ORG, name: "Clínica", role: "admin" },
  } as never);
}

async function anonimizar() {
  const { POST } = await import("@/app/api/v1/lgpd/anonymize/route");
  const res = await POST(
    new NextRequest("http://localhost/api/v1/lgpd/anonymize", {
      method: "POST",
      body: JSON.stringify({ contact_id: CONTATO, justification: "pedido do titular por e-mail" }),
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    }),
  );
  return { status: res.status, corpo: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/v1/lgpd/anonymize — atestado", () => {
  it("chave desligada: sem chave atestado e sem emitir nem tocar a tabela nova", async () => {
    prepara({ flag: false });
    const r = await anonimizar();
    expect(r.status).toBe(200);
    expect("atestado" in r.corpo.data).toBe(false);
    expect(emitirAtestado).not.toHaveBeenCalled();
    expect(tabelasLidasNoAdmin).not.toContain("clinic_atestados_anonimizacao");
  });

  it("chave ligada: devolve o código curto e emite com executor, ip e data", async () => {
    prepara({ flag: true });
    vi.mocked(emitirAtestado).mockResolvedValue({ ok: true, atestado: ATESTADO });
    const r = await anonimizar();
    expect(r.corpo.data.atestado.codigo_curto).toBe("ABCD-1234");
    expect(emitirAtestado).toHaveBeenCalledWith(expect.anything(), {
      orgId: ORG,
      contactId: CONTATO,
      anonimizadoEm: QUANDO,
      executor: { user_id: USER, nome: "Ana Teste", email: "ana@exemplo.test", papel: "administrador" },
      ip: "203.0.113.9",
    });
  });

  it("falha na emissão: continua 200 e informa atestado.erro", async () => {
    prepara({ flag: true });
    vi.mocked(emitirAtestado).mockResolvedValue({ ok: false, erro: "pdf_falhou" });
    const r = await anonimizar();
    expect(r.status).toBe(200);
    expect(r.corpo.data.atestado).toEqual({ erro: "pdf_falhou" });
  });

  it("segunda chamada (already_anonymized): devolve o mesmo atestado já gravado", async () => {
    prepara({ flag: true, jaAnonimizado: true, linhaExistente: ATESTADO });
    vi.mocked(emitirAtestado).mockResolvedValue({ ok: false, erro: "ja_existe", jaExistia: true });
    const r = await anonimizar();
    expect(r.corpo.data.action).toBe("already_anonymized");
    expect(r.corpo.data.atestado).toEqual(ATESTADO);
  });
});

describe("GET/PATCH /api/v1/clinic/config — atestado_anonimizacao", () => {
  function configDb(settings: unknown) {
    const rpc = vi.fn(async () => ({ data: { ligado: true, mudou: false }, error: null }));
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: { settings }, error: null }),
    };
    vi.mocked(createClient).mockResolvedValue({ from: () => q, rpc } as never);
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: { id: USER, idioma: "pt-BR" },
      org: { orgId: ORG, name: "Clínica", role: "admin" },
    } as never);
    return rpc;
  }

  it("GET devolve a chave", async () => {
    configDb({ clinic: { atestado_anonimizacao: true } });
    const { GET } = await import("@/app/api/v1/clinic/config/route");
    const j = await (await GET()).json();
    expect(j.data.atestado_anonimizacao).toBe(true);
  });

  it("PATCH chama a função certa", async () => {
    const rpc = configDb({});
    vi.doMock("@/lib/clinic/acesso/require-permission", () => ({
      requirePermission: async () => ({ ok: true, user: { id: USER, idioma: "pt-BR" }, org: { orgId: ORG, role: "admin" } }),
    }));
    vi.resetModules();
    const { PATCH } = await import("@/app/api/v1/clinic/config/route");
    const res = await PATCH(
      new NextRequest("https://crm.exemplo/api/v1/clinic/config", { method: "PATCH", body: JSON.stringify({ atestado_anonimizacao: true }) }),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("fn_clinic_definir_atestado_anonimizacao", { p_org: ORG, p_ligado: true });
  });
});
