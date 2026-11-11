import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #89 — as regras do fork para "confiar neste dispositivo por 30 dias".
 * O caminho de banco (tabela fechada, sessão amarrada, prazo, fator removido,
 * admin da plataforma) é provado em tests/invariants/mfa-dispositivo-confiavel.test.ts.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const banco = vi.hoisted(() => ({
  platformAdmin: null as { user_id: string } | null,
  vinculos: [] as Array<{ organizations: { settings: unknown } | null }>,
  erroVinculos: null as { message: string } | null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabela: string) => {
      if (tabela === "platform_admins") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: banco.platformAdmin, error: null }) }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ is: async () => ({ data: banco.vinculos, error: banco.erroVinculos }) }),
        }),
      };
    },
  }),
}));

const { dispositivoConfiavelPermitido, empresaPermiteDispositivoConfiavel, sessionIdDoAccessToken } = await import(
  "./dispositivo-confiavel"
);

const permite = { security: { mfa_dispositivo_confiavel: true } };
const naoPermite = { security: { mfa_required: true } };

describe("empresaPermiteDispositivoConfiavel", () => {
  it("nasce desligado: só o booleano true liga", () => {
    expect(empresaPermiteDispositivoConfiavel(permite)).toBe(true);
    expect(empresaPermiteDispositivoConfiavel(naoPermite)).toBe(false);
    expect(empresaPermiteDispositivoConfiavel({ security: { mfa_dispositivo_confiavel: "true" } })).toBe(false);
    expect(empresaPermiteDispositivoConfiavel(null)).toBe(false);
    expect(empresaPermiteDispositivoConfiavel({})).toBe(false);
  });
});

describe("sessionIdDoAccessToken", () => {
  it("lê o session_id do JWT; token estranho volta null", () => {
    const corpo = Buffer.from(JSON.stringify({ session_id: "abc-123" })).toString("base64url");
    expect(sessionIdDoAccessToken(`x.${corpo}.y`)).toBe("abc-123");
    expect(sessionIdDoAccessToken("lixo")).toBeNull();
    const semSessao = Buffer.from(JSON.stringify({ sub: "u" })).toString("base64url");
    expect(sessionIdDoAccessToken(`x.${semSessao}.y`)).toBeNull();
  });
});

describe("dispositivoConfiavelPermitido", () => {
  beforeEach(() => {
    banco.platformAdmin = null;
    banco.vinculos = [];
    banco.erroVinculos = null;
  });

  it("todas as empresas da pessoa permitem → pode", async () => {
    banco.vinculos = [{ organizations: { settings: permite } }, { organizations: { settings: permite } }];
    expect(await dispositivoConfiavelPermitido("u1")).toBe(true);
  });

  it("uma empresa não permite → não pode (a mais restritiva vence)", async () => {
    banco.vinculos = [{ organizations: { settings: permite } }, { organizations: { settings: naoPermite } }];
    expect(await dispositivoConfiavelPermitido("u1")).toBe(false);
  });

  it("sem empresa ativa → não pode", async () => {
    expect(await dispositivoConfiavelPermitido("u1")).toBe(false);
  });

  it("admin da plataforma → nunca pode, mesmo com a empresa permitindo", async () => {
    banco.platformAdmin = { user_id: "u1" };
    banco.vinculos = [{ organizations: { settings: permite } }];
    expect(await dispositivoConfiavelPermitido("u1")).toBe(false);
  });

  it("falha ao ler os vínculos → não pode (falha fechado)", async () => {
    banco.vinculos = [{ organizations: { settings: permite } }];
    banco.erroVinculos = { message: "rede" };
    expect(await dispositivoConfiavelPermitido("u1")).toBe(false);
  });
});
