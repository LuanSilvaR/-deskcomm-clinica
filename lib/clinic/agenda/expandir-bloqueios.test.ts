import { describe, expect, it } from "vitest";

import { horariosLivres } from "@/lib/agenda/horarios-livres";

import { bloqueiosComoExcecoes, type BloqueioDaClinica } from "./expandir-bloqueios";

const DONO = "dono-1";
const COLEGA = "dono-2";

function bloqueio(p: Partial<BloqueioDaClinica>): BloqueioDaClinica {
  return {
    user_id: DONO,
    starts_on: "2026-10-05",
    ends_on: "2026-10-05",
    start_minute: 0,
    end_minute: 1440,
    weekdays: null,
    ...p,
  };
}

describe("bloqueiosComoExcecoes", () => {
  it("período de férias vira um dia bloqueado por data", () => {
    const r = bloqueiosComoExcecoes(
      [bloqueio({ starts_on: "2026-10-05", ends_on: "2026-10-07" })],
      DONO,
      "2026-10-01",
      "2026-10-31",
    );
    expect(r.map((e) => e.data)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
    expect(r.every((e) => e.indisponivel && e.inicioMinuto === 0 && e.fimMinuto === 1440)).toBe(true);
  });

  it("recorrente: só os dias da semana escolhidos (sexta 14h–16h)", () => {
    const r = bloqueiosComoExcecoes(
      [bloqueio({ starts_on: "2026-10-01", ends_on: "2026-10-31", weekdays: [5], start_minute: 840, end_minute: 960 })],
      DONO,
      "2026-10-01",
      "2026-10-31",
    );
    // Outubro/2026: sextas nos dias 2, 9, 16, 23 e 30.
    expect(r.map((e) => e.data)).toEqual(["2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"]);
    expect(r.every((e) => e.inicioMinuto === 840 && e.fimMinuto === 960)).toBe(true);
  });

  it("clínica toda (user_id null) vale para qualquer profissional", () => {
    const r = bloqueiosComoExcecoes([bloqueio({ user_id: null })], COLEGA, "2026-10-01", "2026-10-31");
    expect(r.map((e) => e.data)).toEqual(["2026-10-05"]);
  });

  it("bloqueio de outro profissional não afeta este", () => {
    expect(bloqueiosComoExcecoes([bloqueio({ user_id: COLEGA })], DONO, "2026-10-01", "2026-10-31")).toEqual([]);
  });

  it("recorta pela janela consultada", () => {
    const r = bloqueiosComoExcecoes(
      [bloqueio({ starts_on: "2026-09-28", ends_on: "2026-10-10" })],
      DONO,
      "2026-10-08",
      "2026-10-20",
    );
    expect(r.map((e) => e.data)).toEqual(["2026-10-08", "2026-10-09", "2026-10-10"]);
  });

  it("janela invertida ou sem interseção devolve vazio", () => {
    expect(bloqueiosComoExcecoes([bloqueio({})], DONO, "2026-10-10", "2026-10-01")).toEqual([]);
    expect(bloqueiosComoExcecoes([bloqueio({})], DONO, "2026-11-01", "2026-11-30")).toEqual([]);
  });

  it("weekdays vazio equivale a todos os dias", () => {
    const r = bloqueiosComoExcecoes(
      [bloqueio({ starts_on: "2026-10-05", ends_on: "2026-10-06", weekdays: [] })],
      DONO,
      "2026-10-01",
      "2026-10-31",
    );
    expect(r).toHaveLength(2);
  });
});

describe("bloqueio da clínica no motor real de horários livres", () => {
  const jornada = {
    timezone: "America/Sao_Paulo",
    windows: [1, 2, 3, 4, 5].map((dow) => ({ dow, start: "09:00", end: "18:00" })),
  };
  const tipo = {
    duracaoMin: 60,
    bufferAntesMin: 0,
    bufferDepoisMin: 0,
    avisoMinimoMin: 0,
    intervaloMin: 60,
    janelaDias: 90,
  };
  // Sexta, 2026-10-09, dia inteiro em São Paulo (UTC-3).
  const de = new Date("2026-10-09T03:00:00Z");
  const ate = new Date("2026-10-10T03:00:00Z");
  const agora = new Date("2026-10-01T12:00:00Z");

  function horasLocais(excecoes: ReturnType<typeof bloqueiosComoExcecoes>): string[] {
    return horariosLivres({ jornada, excecoes, ocupados: [], tipo, de, ate, agora }).map((s) =>
      s.inicio.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    );
  }

  it("sem bloqueio, a sexta oferece 09h às 17h", () => {
    expect(horasLocais([])).toEqual(["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  it("recorrente sexta 14h–16h tira exatamente 14h e 15h", () => {
    const excecoes = bloqueiosComoExcecoes(
      [bloqueio({ starts_on: "2026-10-01", ends_on: "2026-12-31", weekdays: [5], start_minute: 840, end_minute: 960 })],
      DONO,
      "2026-10-08",
      "2026-10-10",
    );
    expect(horasLocais(excecoes)).toEqual(["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"]);
  });

  it("férias da clínica toda zeram o dia", () => {
    const excecoes = bloqueiosComoExcecoes(
      [bloqueio({ user_id: null, starts_on: "2026-10-08", ends_on: "2026-10-12" })],
      DONO,
      "2026-10-08",
      "2026-10-10",
    );
    expect(horasLocais(excecoes)).toEqual([]);
  });
});
