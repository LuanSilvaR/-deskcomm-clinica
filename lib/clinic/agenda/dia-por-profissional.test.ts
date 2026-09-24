import { describe, expect, it } from "vitest";

import { bloqueiosNoDia, diaDaSemana, horaDoMinuto, jornadaNoDia, montarColunas, type Disponibilidade } from "./dia-por-profissional";

// 2026-10-07 é quarta-feira (dow 3).
const QUARTA = "2026-10-07";

const ana: Disponibilidade = {
  user_id: "ana",
  schedule: { timezone: "America/Sao_Paulo", windows: [{ dow: 3, start: "13:00", end: "18:00" }, { dow: 3, start: "08:00", end: "12:00" }] },
};
const bia: Disponibilidade = { user_id: "bia", schedule: { windows: [{ dow: 1, start: "09:00", end: "17:00" }] } };

describe("jornada no dia", () => {
  it("dia da semana de um dia de calendário não depende de fuso", () => {
    expect(diaDaSemana(QUARTA)).toBe(3);
  });

  it("só as janelas daquele dia da semana, em ordem", () => {
    expect(jornadaNoDia(ana, QUARTA)).toEqual([
      { inicio_minuto: 480, fim_minuto: 720 },
      { inicio_minuto: 780, fim_minuto: 1080 },
    ]);
    expect(jornadaNoDia(bia, QUARTA)).toEqual([]);
  });
});

describe("bloqueios no dia", () => {
  const bloqueios = [
    { user_id: "ana", starts_on: "2026-10-01", ends_on: "2026-10-31", start_minute: 600, end_minute: 660, weekdays: [3], reason: "Reunião" },
    { user_id: "ana", starts_on: "2026-10-01", ends_on: "2026-10-31", start_minute: 0, end_minute: 1440, weekdays: [1], reason: "Só segunda" },
    { user_id: null, starts_on: QUARTA, ends_on: QUARTA, start_minute: 720, end_minute: 780, weekdays: null, reason: "Almoço" },
    { user_id: "bia", starts_on: QUARTA, ends_on: QUARTA, start_minute: 0, end_minute: 1440, weekdays: null, reason: "Outra pessoa" },
    { user_id: "ana", starts_on: "2026-10-08", ends_on: "2026-10-09", start_minute: 0, end_minute: 1440, weekdays: null, reason: "Depois" },
  ];
  const excecoes = [{ user_id: "ana", is_unavailable: true, start_minute: 900, end_minute: 960, reason: "Médico" }];

  it("da pessoa, da clínica toda e do núcleo; recorrência pelo dia da semana; nada de outra pessoa ou fora do período", () => {
    expect(bloqueiosNoDia("ana", QUARTA, bloqueios, excecoes)).toEqual([
      { inicio_minuto: 600, fim_minuto: 660, motivo: "Reunião", origem: "pessoa" },
      { inicio_minuto: 720, fim_minuto: 780, motivo: "Almoço", origem: "clinica" },
      { inicio_minuto: 900, fim_minuto: 960, motivo: "Médico", origem: "indisponivel" },
    ]);
  });
});

describe("montarColunas", () => {
  const compromisso = (id: string, dono: string | null, inicio: string) => ({
    id,
    owner_user_id: dono,
    titulo: "Consulta",
    inicio,
    fim: inicio,
    status: "confirmed",
    paciente: "Paciente",
    paciente_id: "p",
  });

  it("quem tem jornada no dia aparece; quem tem compromisso fora da jornada também (encaixe)", () => {
    const colunas = montarColunas({
      dia: QUARTA,
      disponibilidades: [ana, bia],
      excecoes: [],
      bloqueios: [],
      compromissos: [
        compromisso("c2", "ana", "2026-10-07T16:00:00Z"),
        compromisso("c1", "ana", "2026-10-07T12:00:00Z"),
        compromisso("c3", "caio", "2026-10-07T13:00:00Z"),
        compromisso("c4", null, "2026-10-07T13:00:00Z"),
      ],
    });
    expect(colunas.map((c) => c.profissional_id).sort()).toEqual(["ana", "caio"]);
    const colunaAna = colunas.find((c) => c.profissional_id === "ana")!;
    expect(colunaAna.compromissos.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(colunas.find((c) => c.profissional_id === "caio")!.jornada).toEqual([]);
  });
});

describe("horaDoMinuto", () => {
  it.each([
    [0, "00:00"],
    [570, "09:30"],
    [1440, "24:00"],
  ])("%d → %s", (m, h) => expect(horaDoMinuto(m)).toBe(h));
});
