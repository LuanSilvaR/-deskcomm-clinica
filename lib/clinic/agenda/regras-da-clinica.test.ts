import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { bloqueiosDaClinicaComoExcecoes, habilitacaoNaConsulta } from "./regras-da-clinica";

const ORG = "22222222-2222-4222-8222-222222222222";
const TIPO = "55555555-5555-4555-8555-555555555555";
const DONO = "11111111-1111-4111-8111-111111111111";

/** Cliente falso: responde por tabela e registra quais tabelas foram lidas. */
function falso(respostas: Record<string, unknown>) {
  const lidas: string[] = [];
  const cliente = {
    from(tabela: string) {
      lidas.push(tabela);
      const cadeia: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "or", "lte", "gte"]) cadeia[m] = () => cadeia;
      const r = { data: respostas[tabela] ?? null, error: null };
      cadeia.maybeSingle = async () => r;
      cadeia.then = (ok: (v: unknown) => unknown) => Promise.resolve(r).then(ok);
      return cadeia;
    },
  };
  return { cliente: cliente as unknown as SupabaseClient, lidas };
}

describe("habilitacaoNaConsulta", () => {
  it("flag desligada: nenhuma tabela clinic_* é consultada (agenda idêntica à original)", async () => {
    const { cliente, lidas } = falso({ organizations: { settings: {} } });
    expect(await habilitacaoNaConsulta(cliente, ORG, TIPO, DONO)).toEqual({ ligado: false });
    expect(lidas.filter((t) => t.startsWith("clinic_"))).toEqual([]);
  });

  it("flag ligada e tipo sem exigência: habilitado", async () => {
    const { cliente } = falso({
      organizations: { settings: { clinic: { profissionais: true } } },
      clinic_event_type_specialties: [],
    });
    expect(await habilitacaoNaConsulta(cliente, ORG, TIPO, DONO)).toEqual({ ligado: true, habilitado: true });
  });

  it("flag ligada, tipo exige e o dono não tem: não habilitado", async () => {
    const { cliente } = falso({
      organizations: { settings: { clinic: { profissionais: true } } },
      clinic_event_type_specialties: [{ specialty_id: "esp-harmonizacao" }],
      clinic_professional_specialties: [],
    });
    expect(await habilitacaoNaConsulta(cliente, ORG, TIPO, DONO)).toEqual({ ligado: true, habilitado: false });
  });

  it("flag ligada, tipo exige e o dono tem: habilitado", async () => {
    const { cliente } = falso({
      organizations: { settings: { clinic: { profissionais: true } } },
      clinic_event_type_specialties: [{ specialty_id: "esp-harmonizacao" }],
      clinic_professional_specialties: [{ specialty_id: "esp-harmonizacao" }],
    });
    expect(await habilitacaoNaConsulta(cliente, ORG, TIPO, DONO)).toEqual({ ligado: true, habilitado: true });
  });
});

describe("bloqueiosDaClinicaComoExcecoes", () => {
  it("dono que não é UUID não chega ao filtro do PostgREST", async () => {
    const { cliente, lidas } = falso({});
    const r = await bloqueiosDaClinicaComoExcecoes(cliente, ORG, "x,user_id.neq.0", "2026-10-01", "2026-10-31");
    expect(r.ok).toBe(false);
    expect(lidas).toEqual([]);
  });

  it("converte as linhas do banco em exceções do dono", async () => {
    const { cliente } = falso({
      clinic_agenda_blocks: [
        { user_id: null, starts_on: "2026-10-12", ends_on: "2026-10-12", start_minute: 0, end_minute: 1440, weekdays: null },
      ],
    });
    const r = await bloqueiosDaClinicaComoExcecoes(cliente, ORG, DONO, "2026-10-01", "2026-10-31");
    expect(r).toEqual({
      ok: true,
      excecoes: [{ data: "2026-10-12", indisponivel: true, inicioMinuto: 0, fimMinuto: 1440 }],
    });
  });
});
