// #83: a chave do lembrete com reserva passa pela rota de opções da clínica.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/clinic/acesso/require-permission", () => ({
  requirePermission: vi.fn(async () => ({
    ok: true,
    user: { id: "11111111-1111-4111-8111-111111111111", idioma: "pt-BR" },
    org: { orgId: "22222222-2222-4222-8222-222222222222", name: "Clínica", role: "admin" },
  })),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));

const ORG = "22222222-2222-4222-8222-222222222222";

const rpc = vi.fn();
let settings: unknown = {};

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { ligado: true, mudou: true }, error: null });
  settings = {};
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: { id: "11111111-1111-4111-8111-111111111111", idioma: "pt-BR" },
    org: { orgId: ORG, name: "Clínica", role: "admin" },
  } as never);
  vi.mocked(createClient).mockResolvedValue({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { settings }, error: null }) }) }),
    }),
    rpc,
  } as never);
});

describe("/api/v1/clinic/config — lembrete_com_reserva", () => {
  it("GET devolve lembrete_com_reserva false por padrão", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    const corpo = (await res.json()) as { data: { lembrete_com_reserva: boolean } };
    expect(corpo.data.lembrete_com_reserva).toBe(false);
  });

  it("GET devolve true quando a clínica ligou", async () => {
    settings = { clinic: { lembrete_com_reserva: true } };
    const { GET } = await import("./route");
    const corpo = (await (await GET()).json()) as { data: { lembrete_com_reserva: boolean } };
    expect(corpo.data.lembrete_com_reserva).toBe(true);
  });

  it("PATCH lembrete_com_reserva chama fn_clinic_definir_lembrete_com_reserva", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new NextRequest("https://crm.exemplo/api/v1/clinic/config", {
        method: "PATCH",
        body: JSON.stringify({ lembrete_com_reserva: true }),
      }),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("fn_clinic_definir_lembrete_com_reserva", { p_org: ORG, p_ligado: true });
  });
});
