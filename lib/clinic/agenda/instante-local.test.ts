import { describe, expect, it } from "vitest";

import { faixaDoBloqueio, instanteNaParede } from "./instante-local";

describe("instanteNaParede", () => {
  it("usa o fuso da regra, não o UTC", () => {
    // 17:00Z = 14:00 em São Paulo (UTC-3).
    expect(instanteNaParede("2026-10-09T17:00:00.000Z", "America/Sao_Paulo")).toEqual({
      data: "2026-10-09",
      minuto: 14 * 60,
    });
  });

  it("vira o dia quando o fuso vira", () => {
    // 01:30Z do dia 10 ainda é 22:30 do dia 9 em São Paulo.
    expect(instanteNaParede("2026-10-10T01:30:00.000Z", "America/Sao_Paulo")).toEqual({
      data: "2026-10-09",
      minuto: 22 * 60 + 30,
    });
  });
});

describe("faixaDoBloqueio", () => {
  it("cobre a duração do atendimento", () => {
    expect(faixaDoBloqueio(840, 60)).toEqual({ start_minute: 840, end_minute: 900 });
  });

  it("não passa da meia-noite", () => {
    expect(faixaDoBloqueio(1410, 60)).toEqual({ start_minute: 1410, end_minute: 1440 });
  });
});
