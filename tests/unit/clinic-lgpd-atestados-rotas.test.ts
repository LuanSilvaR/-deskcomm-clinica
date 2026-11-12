/** Rotas clínicas do atestado de anonimização (#87): listar, gerar depois, baixar, conferir. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { emitirAtestado } from "@/lib/clinic/lgpd/emitir-atestado";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/clinic/lgpd/emitir-atestado", () => ({ emitirAtestado: vi.fn(), BUCKET_DO_ATESTADO: "lgpd-exports" }));
vi.mock("@/lib/impersonate/support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/impersonate/support")>()),
  requireSupportWrite: vi.fn(async () => null),
}));

const ORG = "22222222-2222-4222-8222-222222222222";
const OUTRA = "44444444-4444-4444-8444-444444444444";
const USER = "11111111-1111-4111-8111-111111111111";
const CONTATO = "33333333-3333-4333-8333-333333333333";
const ID = "55555555-5555-4555-8555-555555555555";
const QUANDO = "2026-09-06T12:00:00.000Z";

interface Cenario {
  flag: boolean;
  contato?: unknown;
  linhas?: Array<Record<string, unknown> & { organization_id: string }>;
}

let filtros: Record<string, unknown>[];
let ordenacao: unknown;

function prepara(c: Cenario) {
  filtros = [];
  ordenacao = undefined;
  const admin = {
    from: (tabela: string) => {
      const f: Record<string, unknown> = {};
      filtros.push(f);
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (col: string, v: unknown) => {
          f[col] = v;
          return q;
        },
        order: (col: string, o: unknown) => {
          ordenacao = { col, o };
          return q;
        },
        limit: (n: number) => {
          f.__limit = n;
          return q;
        },
        maybeSingle: async () => {
          if (tabela === "organizations") return { data: { settings: { clinic: { atestado_anonimizacao: c.flag } } }, error: null };
          if (tabela === "contacts") return { data: c.contato ?? null, error: null };
          const l = (c.linhas ?? []).find((x) => Object.entries(f).every(([k, v]) => k === "__limit" || x[k] === v));
          return { data: l ?? null, error: null };
        },
        then: (res: (v: unknown) => unknown) =>
          res({
            data: (c.linhas ?? []).filter((x) => Object.entries(f).every(([k, v]) => k === "__limit" || x[k] === v)),
            error: null,
          }),
      };
      return q;
    },
    storage: { from: () => ({ createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://x.test/${p}` }, error: null }) }) },
  };
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: { id: USER, email: "ana@exemplo.test", full_name: "Ana Teste", idioma: "pt-BR" },
    org: { orgId: ORG, name: "Clínica", role: "admin" },
  } as never);
}

const req = (url: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method: body === undefined ? "GET" : "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
  });

const LINHA = {
  id: ID,
  organization_id: ORG,
  contact_id: CONTATO,
  anonimizado_em: QUANDO,
  emitido_em: QUANDO,
  codigo_curto: "ABCD-EF01-2345-6789",
  algoritmo: "hmac-sha256",
  pdf_path: "org/x.pdf",
  executor_nome: "Ana Teste",
};

beforeEach(() => vi.clearAllMocks());

describe("chave desligada", () => {
  it("GET lista, POST gerar e POST conferir respondem 403 feature_disabled", async () => {
    prepara({ flag: false });
    const lista = await import("@/app/api/v1/clinic/lgpd/atestados/route");
    const conferir = await import("@/app/api/v1/clinic/lgpd/atestados/conferir/route");
    for (const res of [
      await lista.GET(req("/api/v1/clinic/lgpd/atestados")),
      await lista.POST(req("/api/v1/clinic/lgpd/atestados", { contact_id: CONTATO })),
      await conferir.POST(req("/api/v1/clinic/lgpd/atestados/conferir", { codigo: "ABCD-EF01-2345-6789" })),
    ]) {
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("feature_disabled");
    }
  });

  it("GET [id] continua baixando", async () => {
    prepara({ flag: false, linhas: [LINHA] });
    const { GET } = await import("@/app/api/v1/clinic/lgpd/atestados/[id]/route");
    const res = await GET(req(`/api/v1/clinic/lgpd/atestados/${ID}`), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(200);
    const d = (await res.json()).data;
    expect(d).toEqual({ url: "https://x.test/org/x.pdf", expira_em_segundos: 900, codigo_curto: "ABCD-EF01-2345-6789" });
  });
});

describe("GET lista", () => {
  it("filtra pela org, ordena por emitido_em desc e limita a 200", async () => {
    prepara({ flag: true, linhas: [LINHA, { ...LINHA, id: "x", organization_id: OUTRA }] });
    const { GET } = await import("@/app/api/v1/clinic/lgpd/atestados/route");
    const res = await GET(req("/api/v1/clinic/lgpd/atestados"));
    const d = (await res.json()).data;
    expect(d.atestados).toHaveLength(1);
    expect(d.atestados[0].id).toBe(ID);
    expect(ordenacao).toEqual({ col: "emitido_em", o: { ascending: false } });
    expect(filtros.some((f) => f.__limit === 200)).toBe(true);
  });

  it("aceita contact_id e rejeita valor inválido com 422", async () => {
    prepara({ flag: true, linhas: [LINHA, { ...LINHA, id: "y", contact_id: OUTRA }] });
    const { GET } = await import("@/app/api/v1/clinic/lgpd/atestados/route");
    const ok = await (await GET(req(`/api/v1/clinic/lgpd/atestados?contact_id=${CONTATO}`))).json();
    expect(ok.data.atestados).toHaveLength(1);
    const ruim = await GET(req("/api/v1/clinic/lgpd/atestados?contact_id=nao-e-uuid"));
    expect(ruim.status).toBe(422);
  });
});

describe("POST gerar depois", () => {
  it("contato não anonimizado: 409 not_anonymized", async () => {
    prepara({ flag: true, contato: { id: CONTATO, is_anonymized: false, anonymized_at: null } });
    const { POST } = await import("@/app/api/v1/clinic/lgpd/atestados/route");
    const res = await POST(req("/api/v1/clinic/lgpd/atestados", { contact_id: CONTATO }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("not_anonymized");
    expect(emitirAtestado).not.toHaveBeenCalled();
  });

  it("contato anonimizado: emite com a data real, executor e ip", async () => {
    prepara({ flag: true, contato: { id: CONTATO, is_anonymized: true, anonymized_at: QUANDO } });
    vi.mocked(emitirAtestado).mockResolvedValue({
      ok: true,
      atestado: { id: ID, codigo_curto: "ABCD-EF01-2345-6789", algoritmo: "hmac-sha256", emitido_em: QUANDO },
    });
    const { POST } = await import("@/app/api/v1/clinic/lgpd/atestados/route");
    const res = await POST(req("/api/v1/clinic/lgpd/atestados", { contact_id: CONTATO }));
    expect(res.status).toBe(201);
    expect(emitirAtestado).toHaveBeenCalledWith(expect.anything(), {
      orgId: ORG,
      contactId: CONTATO,
      anonimizadoEm: QUANDO,
      executor: { user_id: USER, nome: "Ana Teste", email: "ana@exemplo.test", papel: "administrador" },
      ip: "203.0.113.9",
    });
  });

  it("já emitido: 409 ja_emitido com o id existente", async () => {
    prepara({ flag: true, contato: { id: CONTATO, is_anonymized: true, anonymized_at: QUANDO }, linhas: [LINHA] });
    vi.mocked(emitirAtestado).mockResolvedValue({ ok: false, erro: "ja_existe", jaExistia: true });
    const { POST } = await import("@/app/api/v1/clinic/lgpd/atestados/route");
    const res = await POST(req("/api/v1/clinic/lgpd/atestados", { contact_id: CONTATO }));
    expect(res.status).toBe(409);
    const e = (await res.json()).error;
    expect(e.code).toBe("ja_emitido");
    expect(e.details).toEqual({ id: ID });
  });
});

describe("GET [id]", () => {
  it("atestado de outra org: 404", async () => {
    prepara({ flag: true, linhas: [{ ...LINHA, organization_id: OUTRA }] });
    const { GET } = await import("@/app/api/v1/clinic/lgpd/atestados/[id]/route");
    const res = await GET(req(`/api/v1/clinic/lgpd/atestados/${ID}`), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(404);
  });
});

describe("POST conferir", () => {
  async function conferir(codigo: string) {
    const { POST } = await import("@/app/api/v1/clinic/lgpd/atestados/conferir/route");
    const res = await POST(req("/api/v1/clinic/lgpd/atestados/conferir", { codigo }));
    return { status: res.status, corpo: await res.json() };
  }

  it("normaliza o código digitado e acha a linha", async () => {
    prepara({ flag: true, linhas: [LINHA] });
    const r = await conferir("abcd ef01 2345 6789");
    expect(r.corpo.data).toEqual({
      encontrado: true,
      atestado: { id: ID, anonimizado_em: QUANDO, emitido_em: QUANDO, executor_nome: "Ana Teste", algoritmo: "hmac-sha256" },
    });
  });

  it("código de outra org: encontrado false", async () => {
    prepara({ flag: true, linhas: [{ ...LINHA, organization_id: OUTRA }] });
    const r = await conferir("ABCD-EF01-2345-6789");
    expect(r.status).toBe(200);
    expect(r.corpo.data).toEqual({ encontrado: false });
  });

  it("código inválido: 422", async () => {
    prepara({ flag: true });
    expect((await conferir("xyz")).status).toBe(422);
  });
});
