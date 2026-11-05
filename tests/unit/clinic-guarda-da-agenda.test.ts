/**
 * FORK clinic (agenda S6a, issue #69 — C13): a rota da agenda exige a CHAVE da ação, não só o papel.
 *
 * Atravessa POST/PATCH/DELETE de `app/api/v1/agenda/agendamentos` de verdade, com o
 * papel `agent` aprovado e as permissões efetivas vindas do dublê de `fn_member_permissions`.
 * Sabotagem: tirar a chamada de `exigeChavesDaAgenda` em `despachar` deixa os casos 403 vermelhos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";
import { chavesExigidas } from "@/lib/clinic/agenda/guarda-da-agenda";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

const ORG = "22222222-2222-4222-8222-222222222222";
const BRUNO = "11111111-1111-4111-8111-111111111111";
const AG = "33333333-3333-4333-8333-333333333333";

const usuario: AuthUser = {
  id: BRUNO,
  email: "bruno@clinica.test",
  full_name: "Bruno",
  avatar_url: null,
  is_platform_admin: false,
  idioma: "pt-BR" as const,
  organizations: [{ organization_id: ORG, organization_name: "Clínica", role: "agent" }],
};
const orgAtiva: ActiveOrg = { orgId: ORG, name: "Clínica", role: "agent" };

let permissoes: string[] = [];
const handlerChamado = vi.fn();

vi.mock("@/app/api/v1/agenda/agendamentos/_handler", () => ({
  marcarAgendamentoHandler: vi.fn(async () => (handlerChamado("marcar"), { id: AG })),
  alterarAgendamentoHandler: vi.fn(async () => (handlerChamado("alterar"), { id: AG })),
  cancelarAgendamentoHandler: vi.fn(async () => (handlerChamado("cancelar"), { id: AG })),
}));

beforeEach(() => {
  permissoes = [];
  handlerChamado.mockReset();
  vi.mocked(requireRole).mockResolvedValue({ ok: true, user: usuario, org: orgAtiva } as never);
  vi.mocked(createClient).mockResolvedValue({
    rpc: vi.fn(async (fn: string) =>
      fn === "fn_member_permissions" ? { data: permissoes, error: null } : { data: null, error: { message: "inesperado" } },
    ),
  } as never);
});

function req(metodo: "POST" | "PATCH" | "DELETE", corpo: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/agenda/agendamentos", {
    method: metodo,
    body: JSON.stringify(corpo),
    headers: { "content-type": "application/json" },
  });
}

async function rota() {
  return import("@/app/api/v1/agenda/agendamentos/route");
}

describe("chavesExigidas — o mapa verbo → chave", () => {
  it("POST = marcar, DELETE = cancelar", () => {
    expect(chavesExigidas("marcar", {})).toEqual(["agenda.marcar"]);
    expect(chavesExigidas("cancelar", { id: AG })).toEqual(["agenda.cancelar"]);
  });
  it("PATCH: novo início = remarcar; completed/no_show = desfecho; confirmar/notas = marcar", () => {
    expect(chavesExigidas("alterar", { id: AG, starts_at: "2026-11-05T10:00:00-03:00" })).toEqual(["agenda.remarcar"]);
    expect(chavesExigidas("alterar", { id: AG, status: "completed" })).toEqual(["agenda.registrar_desfecho"]);
    expect(chavesExigidas("alterar", { id: AG, status: "no_show" })).toEqual(["agenda.registrar_desfecho"]);
    expect(chavesExigidas("alterar", { id: AG, status: "confirmed" })).toEqual(["agenda.marcar"]);
    expect(chavesExigidas("alterar", { id: AG, notes: "x" })).toEqual(["agenda.marcar"]);
  });
  it("PATCH que mistura remarcar e desfecho exige as duas", () => {
    expect(chavesExigidas("alterar", { id: AG, starts_at: "2026-11-05T10:00:00-03:00", status: "no_show" }).sort()).toEqual(
      ["agenda.registrar_desfecho", "agenda.remarcar"],
    );
  });
});

describe("rota da agenda — C13: sem a chave, 403 com a chave em details.permissao", () => {
  const casos: Array<[string, "POST" | "PATCH" | "DELETE", unknown, string]> = [
    ["marcar", "POST", { event_type_id: AG, contact_id: AG, starts_at: "2026-11-05T10:00:00-03:00" }, "agenda.marcar"],
    ["remarcar", "PATCH", { id: AG, starts_at: "2026-11-05T10:00:00-03:00" }, "agenda.remarcar"],
    ["desfecho", "PATCH", { id: AG, status: "no_show" }, "agenda.registrar_desfecho"],
    ["cancelar", "DELETE", { id: AG, reason: "paciente pediu" }, "agenda.cancelar"],
  ];

  it.each(casos)("%s sem a chave → 403 e o handler não roda", async (_nome, metodo, corpo, chave) => {
    permissoes = ["agenda.ver", "agenda.bloquear_horario"]; // o papel "Profissional de saúde"
    const r = await rota();
    const res = await r[metodo](req(metodo, corpo));
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: { code: string; details?: { permissao?: string } } };
    expect(json.error.code).toBe("forbidden_permission");
    expect(json.error.details?.permissao).toBe(chave);
    expect(handlerChamado).not.toHaveBeenCalled();
  });

  it.each(casos)("%s com a chave → passa para o handler", async (_nome, metodo, corpo, chave) => {
    permissoes = ["agenda.ver", chave];
    const r = await rota();
    const res = await r[metodo](req(metodo, corpo));
    expect(res.status).toBe(metodo === "POST" ? 201 : 200);
    expect(handlerChamado).toHaveBeenCalledTimes(1);
  });
});
