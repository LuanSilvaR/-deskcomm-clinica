import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const horariosLivresDaOrg = vi.fn();
const profissionaisHabilitados = vi.fn();
vi.mock("@/lib/agenda/consulta", () => ({ horariosLivresDaOrg: (...a: unknown[]) => horariosLivresDaOrg(...a) }));
vi.mock("@/lib/clinic/profissionais/habilitacao", () => ({
  profissionaisHabilitados: (...a: unknown[]) => profissionaisHabilitados(...a),
}));

const { candidatosDoTipo, ordenarProximos, proximosLivres, DIAS_DE_BUSCA } = await import("./proximos-livres");

const AGORA = new Date("2026-10-05T12:00:00Z");
const slot = (iso: string) => ({ inicio: new Date(iso), fim: new Date(new Date(iso).getTime() + 30 * 60_000) });

beforeEach(() => {
  horariosLivresDaOrg.mockReset();
  profissionaisHabilitados.mockReset();
});

describe("ordenarProximos", () => {
  it("do mais cedo para o mais tarde; empate pelo id", () => {
    expect(
      ordenarProximos([
        { profissional_id: "b", inicio: "2026-10-06T13:00:00.000Z", fim: "" },
        { profissional_id: "c", inicio: "2026-10-05T15:00:00.000Z", fim: "" },
        { profissional_id: "a", inicio: "2026-10-06T13:00:00.000Z", fim: "" },
      ]).map((p) => p.profissional_id),
    ).toEqual(["c", "a", "b"]);
  });
});

describe("proximosLivres", () => {
  it("consulta cada profissional com a MESMA função da grade e devolve o primeiro horário de cada um", async () => {
    horariosLivresDaOrg.mockImplementation(async (_s: unknown, _o: unknown, p: { ownerUserId: string }) => {
      if (p.ownerUserId === "ana") return { ok: true, slots: [slot("2026-10-07T13:00:00Z"), slot("2026-10-06T14:00:00Z")] };
      if (p.ownerUserId === "bia") return { ok: true, slots: [slot("2026-10-05T16:00:00Z")] };
      return { ok: true, slots: [] };
    });
    const r = await proximosLivres({} as SupabaseClient, "org", { eventTypeId: "tipo", candidatos: ["ana", "bia", "caio"], agora: AGORA });
    expect(r.proximos.map((p) => [p.profissional_id, p.inicio])).toEqual([
      ["bia", "2026-10-05T16:00:00.000Z"],
      ["ana", "2026-10-06T14:00:00.000Z"],
    ]);
    expect(r.sem_horario).toEqual(["caio"]);
    const chamada = horariosLivresDaOrg.mock.calls[0]![2] as { eventTypeId: string; de: Date; ate: Date };
    expect(chamada.eventTypeId).toBe("tipo");
    expect(chamada.ate.getTime() - chamada.de.getTime()).toBe(DIAS_DE_BUSCA * 86_400_000);
  });

  it("recusa da consulta (ex.: profissional_nao_habilitado) conta como sem horário, nunca como horário", async () => {
    horariosLivresDaOrg.mockResolvedValue({ ok: false, codigo: "profissional_nao_habilitado" });
    const r = await proximosLivres({} as SupabaseClient, "org", { eventTypeId: "tipo", candidatos: ["ana"], agora: AGORA });
    expect(r).toEqual({ proximos: [], sem_horario: ["ana"] });
  });
});

describe("candidatosDoTipo", () => {
  it("tipo com especialidade: só os habilitados", async () => {
    profissionaisHabilitados.mockResolvedValue({ ok: true, userIds: ["ana", "bia"] });
    expect(await candidatosDoTipo({} as SupabaseClient, "org", "tipo")).toEqual({ ok: true, userIds: ["ana", "bia"] });
  });

  it("tipo sem especialidade: quem publicou jornada na organização", async () => {
    profissionaisHabilitados.mockResolvedValue({ ok: true, userIds: null });
    const filtros: unknown[] = [];
    const cadeia = {
      select: () => cadeia,
      eq: (c: string, v: unknown) => (filtros.push([c, v]), cadeia),
      limit: async () => ({ data: [{ user_id: "ana" }, { user_id: "ana" }, { user_id: "caio" }], error: null }),
    };
    const supabase = { from: (t: string) => (expect(t).toBe("attendant_availability"), cadeia) } as unknown as SupabaseClient;
    expect(await candidatosDoTipo(supabase, "org-x", "tipo")).toEqual({ ok: true, userIds: ["ana", "caio"] });
    expect(filtros).toContainEqual(["organization_id", "org-x"]);
  });
});
