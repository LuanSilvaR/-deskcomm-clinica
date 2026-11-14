import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
const rpc = vi.fn();
const audit = vi.fn();
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: (...a: unknown[]) => rpc(...a) }) }));
vi.mock("@/lib/audit", () => ({ audit: (...a: unknown[]) => audit(...a) }));

const { requirePermission } = await import("./require-permission");

const usuario = { id: "u1", idioma: "pt-BR", is_platform_admin: false, support: null };
const ok = { ok: true, user: usuario, org: { orgId: "org-1", name: "Clínica", role: "agent" } };

beforeEach(() => {
  requireRole.mockReset();
  rpc.mockReset();
  audit.mockReset();
});

describe("requirePermission", () => {
  it("passa quando a permissão está entre as efetivas (e usa o piso viewer do requireRole)", async () => {
    requireRole.mockResolvedValue(ok);
    rpc.mockResolvedValue({ data: ["agenda.ver", "agenda.marcar"], error: null });
    const r = await requirePermission("agenda.marcar", { requestId: "req" });
    expect(r.ok).toBe(true);
    expect(requireRole).toHaveBeenCalledWith("viewer", { requestId: "req" });
    expect(rpc).toHaveBeenCalledWith("fn_member_permissions", { p_org: "org-1" });
  });

  it("nega com 403 forbidden_permission e audita authz.denied com a permissão pedida", async () => {
    requireRole.mockResolvedValue(ok);
    rpc.mockResolvedValue({ data: ["agenda.ver"], error: null });
    const r = await requirePermission("agenda.cancelar", { requestId: "req", resource: "calendar_appointments" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(403);
      expect(((await r.response.json()) as { error: { code: string } }).error.code).toBe("forbidden_permission");
    }
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "authz.denied", metadata: expect.objectContaining({ required_permission: "agenda.cancelar" }) }),
    );
  });

  it("sem sessão/empresa/MFA: devolve a recusa do requireRole, sem perguntar ao banco", async () => {
    const negado = { ok: false, response: new Response(null, { status: 401 }) };
    requireRole.mockResolvedValue(negado);
    expect(await requirePermission("agenda.ver")).toBe(negado);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("erro do banco não vira permissão: 500", async () => {
    requireRole.mockResolvedValue(ok);
    rpc.mockResolvedValue({ data: null, error: { message: "caiu" } });
    const r = await requirePermission("agenda.ver");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(500);
  });

  it("chave fora do catálogo é erro de programação (500), nunca passa", async () => {
    const r = await requirePermission("sistema.superpoder" as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(500);
    expect(requireRole).not.toHaveBeenCalled();
  });

  it("plataforma, quando a rota permite, passa sem papéis de empresa", async () => {
    requireRole.mockResolvedValue({ ...ok, user: { ...usuario, is_platform_admin: true } });
    const r = await requirePermission("auditoria.ver", { allowPlatformAdmin: true });
    expect(r.ok).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});
