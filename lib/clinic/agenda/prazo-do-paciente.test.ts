import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Actor, HandlerCtx } from "@/lib/api/handlers/types";

import { dentroDoPrazo, exigePrazoDoPaciente, prazoDoPacienteHoras } from "./prazo-do-paciente";
import { agruparFaltosos, ehReincidente } from "./faltas";

const AGORA = new Date("2026-10-05T12:00:00Z");
const org = (settings: unknown) =>
  ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { settings }, error: null }) }) }) }),
  }) as unknown as SupabaseClient;
const ctx = (actor: Actor): HandlerCtx => ({ organization_id: "org", actor, requestId: "req" });
const IA: Actor = { type: "ai_agent", id: "run", role: "agent" };
const PESSOA: Actor = { type: "user", id: "u", role: "agent" };

describe("prazo do paciente", () => {
  it("nasce sem prazo; só inteiro de 1 a 168 liga", () => {
    expect(prazoDoPacienteHoras(undefined)).toBe(0);
    expect(prazoDoPacienteHoras({ clinic: { prazo_paciente_horas: "24" } })).toBe(0);
    expect(prazoDoPacienteHoras({ clinic: { prazo_paciente_horas: 500 } })).toBe(0);
    expect(prazoDoPacienteHoras({ clinic: { prazo_paciente_horas: 24 } })).toBe(24);
  });

  it("dentro do prazo = faltam menos horas que o prazo (ou já começou)", () => {
    expect(dentroDoPrazo(new Date("2026-10-06T11:00:00Z"), AGORA, 24)).toBe(true);
    expect(dentroDoPrazo(new Date("2026-10-06T12:00:00Z"), AGORA, 24)).toBe(false);
    expect(dentroDoPrazo(new Date("2026-10-05T11:00:00Z"), AGORA, 24)).toBe(true);
    expect(dentroDoPrazo(new Date("2026-10-05T13:00:00Z"), AGORA, 0)).toBe(false);
  });

  it("a IA dentro do prazo recebe agenda_fora_do_prazo", async () => {
    await expect(
      exigePrazoDoPaciente(org({ clinic: { prazo_paciente_horas: 24 } }), ctx(IA), "2026-10-06T08:00:00Z", AGORA),
    ).rejects.toMatchObject({ status: 422, code: "agenda_fora_do_prazo" });
  });

  it("a IA fora do prazo passa; a pessoa da equipe passa sempre; sem prazo passa", async () => {
    await expect(exigePrazoDoPaciente(org({ clinic: { prazo_paciente_horas: 24 } }), ctx(IA), "2026-10-07T08:00:00Z", AGORA)).resolves.toBeUndefined();
    await expect(exigePrazoDoPaciente(org({ clinic: { prazo_paciente_horas: 24 } }), ctx(PESSOA), "2026-10-05T13:00:00Z", AGORA)).resolves.toBeUndefined();
    await expect(exigePrazoDoPaciente(org({}), ctx(IA), "2026-10-05T13:00:00Z", AGORA)).resolves.toBeUndefined();
  });
});

describe("faltas", () => {
  it("reincidente a partir de 2", () => {
    expect(ehReincidente(1)).toBe(false);
    expect(ehReincidente(2)).toBe(true);
  });

  it("agrupa por paciente, só reincidentes, do que mais faltou; guarda a última falta", () => {
    expect(
      agruparFaltosos([
        { contact_id: "a", starts_at: "2026-03-01T10:00:00Z" },
        { contact_id: "b", starts_at: "2026-01-01T10:00:00Z" },
        { contact_id: "a", starts_at: "2026-08-01T10:00:00Z" },
        { contact_id: "c", starts_at: "2026-02-01T10:00:00Z" },
        { contact_id: "c", starts_at: "2026-04-01T10:00:00Z" },
        { contact_id: "c", starts_at: "2026-05-01T10:00:00Z" },
        { contact_id: null, starts_at: "2026-05-01T10:00:00Z" },
      ]),
    ).toEqual([
      { contact_id: "c", faltas: 3, ultima_falta: "2026-05-01T10:00:00Z" },
      { contact_id: "a", faltas: 2, ultima_falta: "2026-08-01T10:00:00Z" },
    ]);
  });
});
