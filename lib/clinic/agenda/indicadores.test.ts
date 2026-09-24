import { describe, expect, it } from "vitest";

import { calcularIndicadores, diasDoPeriodo, minutosDeJornada } from "./indicadores";

const c = (dono: string | null, status: string, inicio = "2026-09-01T12:00:00Z", fim = "2026-09-01T12:30:00Z") => ({
  owner_user_id: dono,
  status,
  starts_at: inicio,
  ends_at: fim,
});

describe("período e jornada", () => {
  it("dias de calendário inclusivos", () => {
    expect(diasDoPeriodo("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("minutos de jornada somam as janelas de cada dia da semana do período", () => {
    // 2026-09-28 é segunda (1); 2026-09-29 terça (2).
    const j = { user_id: "ana", schedule: { windows: [{ dow: 1, start: "09:00", end: "12:00" }, { dow: 1, start: "13:00", end: "17:00" }] } };
    expect(minutosDeJornada(j, ["2026-09-28", "2026-09-29"])).toBe(420);
    expect(minutosDeJornada(undefined, ["2026-09-28"])).toBe(0);
  });
});

describe("calcularIndicadores", () => {
  const base = {
    compromissos: [
      c("ana", "completed"),
      c("ana", "completed"),
      c("ana", "no_show"),
      c("ana", "cancelled"),
      c("ana", "confirmed"),
      c("bia", "no_show"),
      c(null, "completed"),
    ],
    visitas: [
      { arrived_at: "2026-09-01T11:50:00Z", started_at: "2026-09-01T12:05:00Z", finished_at: "2026-09-01T12:45:00Z" },
      { arrived_at: "2026-09-01T11:55:00Z", started_at: "2026-09-01T12:00:00Z", finished_at: null },
      { arrived_at: null, started_at: null, finished_at: null },
    ],
    confirmacoes: [{ status: "confirmado" }, { status: "confirmado" }, { status: "recusado" }, { status: "sem_resposta" }, { status: "aguardando" }],
    jornadas: [
      { user_id: "ana", schedule: { windows: [{ dow: 1, start: "09:00", end: "12:00" }] } },
      { user_id: "caio", schedule: { windows: [{ dow: 1, start: "09:00", end: "10:00" }] } },
    ],
    dias: ["2026-09-28"],
  };

  it("taxa de faltas deixa de fora cancelado e o que ficou sem registro", () => {
    const r = calcularIndicadores(base);
    expect(r).toMatchObject({ agendados: 7, realizados: 3, faltas: 2, cancelados: 1, sem_registro: 1 });
    expect(r.taxa_de_faltas).toBeCloseTo(2 / 5);
  });

  it("espera e duração médias vêm do status da visita", () => {
    const r = calcularIndicadores(base);
    expect(r.espera_media_min).toBe(10); // (15 + 5) / 2
    expect(r.atendimento_medio_min).toBe(40);
  });

  it("confirmação por resultado", () => {
    expect(calcularIndicadores(base).confirmacao).toEqual({ pedidos: 5, confirmados: 2, recusados: 1, sem_resposta: 1, aguardando: 1 });
  });

  it("por profissional: ocupação = marcado (sem cancelado) ÷ jornada; quem só tem jornada aparece com zero", () => {
    const r = calcularIndicadores(base);
    const ana = r.por_profissional.find((p) => p.profissional_id === "ana")!;
    expect(ana).toMatchObject({ agendados: 5, realizados: 2, faltas: 1, cancelados: 1, sem_registro: 1, minutos_marcados: 120, minutos_de_jornada: 180 });
    expect(ana.ocupacao).toBeCloseTo(120 / 180);
    const bia = r.por_profissional.find((p) => p.profissional_id === "bia")!;
    expect(bia.ocupacao).toBeNull(); // sem jornada publicada: não há denominador
    expect(bia.taxa_de_faltas).toBe(1);
    expect(r.por_profissional.find((p) => p.profissional_id === "caio")).toMatchObject({ agendados: 0, ocupacao: 0 });
  });

  it("sem dado nenhum: taxas e médias nulas, nunca NaN", () => {
    const r = calcularIndicadores({ compromissos: [], visitas: [], confirmacoes: [], jornadas: [], dias: [] });
    expect(r.taxa_de_faltas).toBeNull();
    expect(r.espera_media_min).toBeNull();
    expect(r.por_profissional).toEqual([]);
  });
});
