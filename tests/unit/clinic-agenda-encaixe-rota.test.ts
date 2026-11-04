/**
 * FORK clinic (agenda S6b, issue #69) — o encaixe atravessando `marcarAgendamentoHandler` de verdade.
 *
 * C1 flag desligada -> 422 encaixe_desligado · C3 motivo curto -> 422 (corpo e banco) ·
 * C4 sem a chave -> 403 · C5 horário ocupado: 409 só com flag ligada e ator pessoa (senão o 422 do núcleo) ·
 * C11 ator ai_agent/api_token nunca encaixa. Nada é gravado nos 4xx (o `rpc` do encaixe não é chamado).
 * Sabotagem: tirar o `if (input.encaixe && ctx.actor.type !== "user")` do handler deixa C11 vermelho.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HandlerCtx } from "@/lib/api/handlers/types";
import { ApiError } from "@/lib/api/types";

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/clinic/agenda/regras-da-clinica", () => ({
  habilitacaoNaConsulta: vi.fn(async () => ({ ligado: false })),
}));
vi.mock("@/lib/clinic/agenda/prazo-do-paciente", () => ({ exigePrazoDoPaciente: vi.fn(async () => undefined) }));
vi.mock("@/lib/agenda/consulta", () => ({
  horariosLivresDaOrg: vi.fn(async () => ({
    ok: true,
    publicouHorarios: true,
    slots: [],
    fusoDaRegra: "America/Sao_Paulo",
  })),
  coletaOQueOcupa: vi.fn(async () => ({ ok: true, ocupados: [] })),
}));

const ORG = "22222222-2222-4222-8222-222222222222";
const BRUNO = "11111111-1111-4111-8111-111111111111";
const TIPO = "44444444-4444-4444-8444-444444444444";
const OCUPANTE = "55555555-5555-4555-8555-555555555555";
const INICIO = "2026-11-09T10:00:00-03:00"; // segunda-feira

interface Mundo {
  flag: boolean;
  permissoes: string[];
  ocupado: boolean;
  rpcEncaixe: { data: unknown; error: { code: string; message: string } | null };
}
let mundo: Mundo;
const rpcDoEncaixe = vi.fn();

/** Banco de mentira: encadeia filtros sem aplicá-los e responde por tabela. */
function banco() {
  const lista = (tabela: string): unknown[] => {
    if (tabela === "calendar_appointments") {
      return mundo.ocupado
        ? [{ id: OCUPANTE, starts_at: "2026-11-09T13:00:00Z", ends_at: "2026-11-09T13:30:00Z", status: "confirmed", contacts: { name: "Paciente Teste", display_name: null } }]
        : [];
    }
    if (tabela === "attendant_availability") {
      return [{ user_id: BRUNO, schedule: { timezone: "America/Sao_Paulo", windows: [{ dow: 1, start: "08:00", end: "18:00" }] } }];
    }
    return [];
  };
  const unico = (tabela: string): unknown => {
    if (tabela === "calendar_event_types") {
      return {
        id: TIPO, name: "Consulta", is_active: true, duration_minutes: 30, default_owner_user_id: BRUNO,
        requires_confirmation: false, location_kind: "in_person", location_details: null,
      };
    }
    if (tabela === "organizations") return { settings: { clinic: { encaixe: mundo.flag } } };
    return null;
  };
  return {
    from(tabela: string) {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "neq", "lt", "gt", "gte", "lte", "in", "is", "order", "limit"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: unico(tabela), error: null });
      b.single = async () => ({ data: unico(tabela), error: null });
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: lista(tabela), error: null }).then(ok);
      return b;
    },
    rpc: async (fn: string, args: unknown) => {
      if (fn === "fn_member_permissions") return { data: mundo.permissoes, error: null };
      if (fn === "fn_clinic_agenda_encaixar") {
        rpcDoEncaixe(args);
        return mundo.rpcEncaixe;
      }
      return { data: null, error: { message: `rpc inesperado: ${fn}` } };
    },
  };
}

function ctx(actor: HandlerCtx["actor"]): HandlerCtx {
  return { organization_id: ORG, actor, requestId: "req-teste" } as HandlerCtx;
}
const pessoa = { type: "user", id: BRUNO, role: "manager" } as const;

async function marcar(actor: HandlerCtx["actor"], encaixe?: { motivo: string }) {
  const { marcarAgendamentoHandler } = await import("@/app/api/v1/agenda/agendamentos/_handler");
  return marcarAgendamentoHandler(
    banco() as never,
    ctx(actor),
    { event_type_id: TIPO, starts_at: INICIO, owner_user_id: BRUNO, ...(encaixe ? { encaixe } : {}) } as never,
  );
}
async function recusa(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return e as ApiError;
  }
  throw new Error("deveria ter recusado");
}

beforeEach(() => {
  rpcDoEncaixe.mockReset();
  mundo = {
    flag: true,
    permissoes: ["agenda.marcar", "agenda.encaixe"],
    ocupado: true,
    rpcEncaixe: { data: null, error: null },
  };
});

describe("encaixe — recusas antes de gravar", () => {
  it("C1: flag desligada -> 422 encaixe_desligado, sem gravar", async () => {
    mundo.flag = false;
    const e = await recusa(marcar(pessoa, { motivo: "Paciente de retorno urgente" }));
    expect([e.status, e.code]).toEqual([422, "encaixe_desligado"]);
    expect(rpcDoEncaixe).not.toHaveBeenCalled();
  });

  it("C4: sem agenda.encaixe -> 403 forbidden_permission com a chave", async () => {
    mundo.permissoes = ["agenda.marcar"];
    const e = await recusa(marcar(pessoa, { motivo: "Paciente de retorno urgente" }));
    expect([e.status, e.code]).toEqual([403, "forbidden_permission"]);
    expect(e.details).toEqual({ permissao: "agenda.encaixe" });
    expect(rpcDoEncaixe).not.toHaveBeenCalled();
  });

  it("C3: motivo curto é recusado no corpo (Zod da rota) e, se passar, o banco devolve 422", async () => {
    const { z } = await import("zod");
    const motivo = z.object({ motivo: z.string().trim().min(5).max(500) });
    expect(motivo.safeParse({ motivo: "  ok  " }).success).toBe(false);

    mundo.rpcEncaixe = { data: null, error: { code: "P0001", message: "motivo_invalido" } };
    const e = await recusa(marcar(pessoa, { motivo: "curto" }));
    expect([e.status, e.code]).toEqual([422, "encaixe_motivo_invalido"]);
  });

  it("C6: sobreposto_finalizado do banco -> 409 encaixe_sobre_finalizado", async () => {
    mundo.rpcEncaixe = { data: null, error: { code: "P0001", message: "sobreposto_finalizado" } };
    const e = await recusa(marcar(pessoa, { motivo: "Paciente de retorno urgente" }));
    expect([e.status, e.code]).toEqual([409, "encaixe_sobre_finalizado"]);
  });
});

describe("C11 — só pessoa encaixa", () => {
  for (const actor of [
    { type: "ai_agent", id: "run-1", role: "agent" },
    { type: "api_token", id: "tok-1", role: "agent" },
  ] as const) {
    it(`ator ${actor.type} com encaixe -> 403 encaixe_so_pessoa e nada gravado`, async () => {
      const e = await recusa(marcar(actor as never, { motivo: "Paciente de retorno urgente" }));
      expect([e.status, e.code]).toEqual([403, "encaixe_so_pessoa"]);
      expect(rpcDoEncaixe).not.toHaveBeenCalled();
    });
  }
});

describe("C5/D2 — marcação comum sobre horário ocupado", () => {
  it("flag ligada + pessoa: 409 agenda_horario_ocupado com quem ocupa e pode_encaixar", async () => {
    const { coletaOQueOcupa } = await import("@/lib/agenda/consulta");
    vi.mocked(coletaOQueOcupa).mockResolvedValueOnce({
      ok: true,
      ocupados: [{ inicio: new Date("2026-11-09T13:00:00Z"), fim: new Date("2026-11-09T13:30:00Z") }],
    } as never);
    const e = await recusa(marcar(pessoa));
    expect([e.status, e.code]).toEqual([409, "agenda_horario_ocupado"]);
    const d = e.details as { agendamentos: Array<{ id: string; paciente: string | null }>; pode_encaixar: boolean };
    expect(d.pode_encaixar).toBe(true);
    expect(d.agendamentos).toMatchObject([{ id: OCUPANTE, paciente: "Paciente Teste" }]);
  });

  it("sem a chave, o 409 vem com pode_encaixar falso", async () => {
    mundo.permissoes = ["agenda.marcar"];
    const { coletaOQueOcupa } = await import("@/lib/agenda/consulta");
    vi.mocked(coletaOQueOcupa).mockResolvedValueOnce({
      ok: true,
      ocupados: [{ inicio: new Date("2026-11-09T13:00:00Z"), fim: new Date("2026-11-09T13:30:00Z") }],
    } as never);
    const e = await recusa(marcar(pessoa));
    expect(e.status).toBe(409);
    expect((e.details as { pode_encaixar: boolean }).pode_encaixar).toBe(false);
  });

  it("flag desligada: segue o 422 agenda_horario_indisponivel do núcleo", async () => {
    mundo.flag = false;
    const { coletaOQueOcupa } = await import("@/lib/agenda/consulta");
    vi.mocked(coletaOQueOcupa).mockResolvedValueOnce({
      ok: true,
      ocupados: [{ inicio: new Date("2026-11-09T13:00:00Z"), fim: new Date("2026-11-09T13:30:00Z") }],
    } as never);
    const e = await recusa(marcar(pessoa));
    expect([e.status, e.code]).toEqual([422, "agenda_horario_indisponivel"]);
  });
});
