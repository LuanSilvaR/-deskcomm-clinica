import { describe, expect, it } from "vitest";

import { intervalosSemRecurso, recursosLigados } from "./recursos";

const DE = new Date("2030-02-12T08:00:00Z");
const ATE = new Date("2030-02-12T18:00:00Z");
const h = (hhmm: string) => `2030-02-12T${hhmm}:00.000Z`;
const faixas = (o: { inicio: Date; fim: Date }[]) => o.map((x) => `${x.inicio.toISOString().slice(11, 16)}-${x.fim.toISOString().slice(11, 16)}`);

const salas = [
  { id: "s1", category: "Sala", is_active: true },
  { id: "s2", category: "sala ", is_active: true },
  { id: "s3", category: "Sala", is_active: false },
];
const laser = { id: "laser", category: "Equipamento", is_active: true };

describe("recursosLigados", () => {
  it("nasce desligada; só o booleano true liga", () => {
    expect(recursosLigados(undefined)).toBe(false);
    expect(recursosLigados({ clinic: { recursos: "true" } })).toBe(false);
    expect(recursosLigados({ clinic: { recursos: true } })).toBe(true);
  });
});

describe("intervalosSemRecurso", () => {
  it("categoria: só falta quando TODAS as salas ativas estão ocupadas (a inativa não conta)", () => {
    const r = intervalosSemRecurso({
      exigencias: [{ category: "SALA", resource_id: null }],
      recursos: salas,
      alocacoes: [
        { resource_id: "s1", starts_at: h("10:00"), ends_at: h("11:00") },
        { resource_id: "s2", starts_at: h("10:30"), ends_at: h("12:00") },
      ],
      de: DE,
      ate: ATE,
    });
    expect(faixas(r)).toEqual(["10:30-11:00"]);
  });

  it("equipamento específico: ocupado = falta", () => {
    const r = intervalosSemRecurso({
      exigencias: [{ category: null, resource_id: "laser" }],
      recursos: [laser, ...salas],
      alocacoes: [{ resource_id: "laser", starts_at: h("13:00"), ends_at: h("13:30") }],
      de: DE,
      ate: ATE,
    });
    expect(faixas(r)).toEqual(["13:00-13:30"]);
  });

  it("duas salas no mesmo procedimento: falta assim que resta uma só", () => {
    const r = intervalosSemRecurso({
      exigencias: [
        { category: "Sala", resource_id: null },
        { category: "sala", resource_id: null },
      ],
      recursos: salas,
      alocacoes: [{ resource_id: "s2", starts_at: h("09:00"), ends_at: h("09:30") }],
      de: DE,
      ate: ATE,
    });
    expect(faixas(r)).toEqual(["09:00-09:30"]);
  });

  it("exigência sem recurso cadastrado bloqueia a janela inteira", () => {
    const r = intervalosSemRecurso({ exigencias: [{ category: "Maca", resource_id: null }], recursos: salas, alocacoes: [], de: DE, ate: ATE });
    expect(faixas(r)).toEqual(["08:00-18:00"]);
  });

  it("várias exigências: junta as faltas de cada uma, sem pedaço repetido", () => {
    const r = intervalosSemRecurso({
      exigencias: [
        { category: null, resource_id: "laser" },
        { category: "Sala", resource_id: null },
      ],
      recursos: [laser, ...salas],
      alocacoes: [
        { resource_id: "laser", starts_at: h("10:00"), ends_at: h("10:45") },
        { resource_id: "s1", starts_at: h("10:30"), ends_at: h("11:30") },
        { resource_id: "s2", starts_at: h("10:30"), ends_at: h("11:30") },
      ],
      de: DE,
      ate: ATE,
    });
    expect(faixas(r)).toEqual(["10:00-11:30"]);
  });

  it("sem exigência, nada falta", () => {
    expect(intervalosSemRecurso({ exigencias: [], recursos: salas, alocacoes: [], de: DE, ate: ATE })).toEqual([]);
  });
});
