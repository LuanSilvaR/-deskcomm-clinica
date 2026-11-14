/**
 * #154 — a clínica criada pelo /admin nasce com os módulos de clínica ligados.
 * A rota chama `fn_clinic_aplicar_pacote_inicial` com o id devolvido pela
 * criação (fonte confiável), só quando a organização foi criada de fato.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const h = vi.hoisted(() => ({ guard: vi.fn(), mfa: vi.fn(), rpc: vi.fn(), audit: vi.fn(), invite: vi.fn() }));
vi.mock("@/lib/auth/requirePlatformAdmin", () => ({ requirePlatformAdmin: h.guard }));
vi.mock("@/lib/auth/server", () => ({ mfaEmDivida: h.mfa, mfaEmDividaEstrita: h.mfa, loadAuthUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: h.rpc }) }));
vi.mock("@/lib/audit", () => ({ audit: h.audit }));
vi.mock("@/lib/auth/issue-invite", () => ({ issueInvite: h.invite }));
import { POST } from "@/app/api/v1/admin/tenants/route";
import { aplicarPacoteInicialClinica, PACOTE_INICIAL_CLINICA } from "@/lib/clinic/organizacao/pacote-inicial";

const actor = "c1540000-0000-4000-8000-000000000001";
const org = "c1540000-0000-4000-8000-000000000002";
const criada = (created: boolean) => ({
  data: { id: org, display_name: "Clínica Teste", slug: "clinica-teste", created, invite_id: actor, issued_at: 1 },
  error: null,
});
function request(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/v1/admin/tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "c1540000-0000-4000-8000-000000000003" },
    body: JSON.stringify({ display_name: "Clínica Teste", slug: "clinica-teste", owner_email: "dona@example.test", ...body }),
  });
}
const chamadasDoPacote = () => h.rpc.mock.calls.filter(([nome]) => nome === "fn_clinic_aplicar_pacote_inicial");

beforeEach(() => {
  vi.resetAllMocks();
  h.guard.mockResolvedValue({ user: { id: actor, email: "admin@example.test", user_metadata: {} }, platformAdmin: { scope: "full" } });
  h.mfa.mockResolvedValue(false);
  h.invite.mockResolvedValue({ accept_url: "http://localhost/invite", email_dispatched: false });
});

describe("pacote inicial da clínica (#154)", () => {
  it("aplica o pacote na organização recém-criada, com o id devolvido pela criação", async () => {
    h.rpc.mockResolvedValueOnce(criada(true)).mockResolvedValueOnce({ data: {}, error: null });
    const res = await POST(request({ id: "c1540000-0000-4000-8000-0000000000ff" }));
    expect(res.status).toBe(201);
    expect(chamadasDoPacote()).toEqual([["fn_clinic_aplicar_pacote_inicial", { p_org: org }]]);
    expect((await res.json()).data.pacote_clinica_aplicado).toBe(true);
  });

  it("aplica antes de emitir o convite da dona", async () => {
    h.rpc.mockResolvedValueOnce(criada(true)).mockResolvedValueOnce({ data: {}, error: null });
    await POST(request());
    expect(h.rpc.mock.invocationCallOrder[1]).toBeLessThan(h.invite.mock.invocationCallOrder[0]!);
  });

  it("repetição idempotente (organização já existia) não reaplica", async () => {
    h.rpc.mockResolvedValueOnce(criada(false));
    const res = await POST(request());
    expect(res.status).toBe(201);
    expect(chamadasDoPacote()).toHaveLength(0);
    expect((await res.json()).data.pacote_clinica_aplicado).toBeNull();
  });

  it("falha no pacote não desfaz a criação: 201 e aplicado=false", async () => {
    h.rpc.mockResolvedValueOnce(criada(true)).mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    const res = await POST(request());
    expect(res.status).toBe(201);
    expect((await res.json()).data.pacote_clinica_aplicado).toBe(false);
  });

  it("falha na criação não chama o pacote", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    expect((await POST(request())).status).toBe(409);
    expect(chamadasDoPacote()).toHaveLength(0);
  });

  it("o helper nunca lança e o pacote é o decidido pelo dono", async () => {
    const quebrado = { rpc: vi.fn().mockRejectedValue(new Error("rede")) };
    expect(await aplicarPacoteInicialClinica(quebrado as never, org)).toBe(false);
    expect([...PACOTE_INICIAL_CLINICA].sort()).toEqual(
      ["encaixe", "estoque", "menu_clinica", "orcamentos", "procedimentos", "profissionais", "prontuario", "recursos", "trava_sobreposicao"],
    );
  });
});
