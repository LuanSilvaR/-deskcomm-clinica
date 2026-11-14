import { describe, expect, it } from "vitest";

import { minutoNoDia, montarAgendaDoDia, textoDoConselho } from "@/lib/clinic/agenda/agenda-do-dia";
import type { ColunaDoProfissional } from "@/lib/clinic/agenda/dia-por-profissional";
import { periodoDoMinuto, statusDeExibicao } from "@/lib/clinic/visitas/exibicao";

const FUSO = "America/Campo_Grande"; // UTC-4, sem horário de verão
const DIA = "2026-10-01";
const iso = (hhmm: string) => new Date(`${DIA}T${hhmm}:00-04:00`).toISOString();

function coluna(parcial: Partial<ColunaDoProfissional>): ColunaDoProfissional {
  return { profissional_id: "p1", jornada: [{ inicio_minuto: 8 * 60, fim_minuto: 10 * 60 }], bloqueios: [], compromissos: [], ...parcial };
}

function compromisso(id: string, de: string, ate: string, status = "confirmed", paciente_id: string | null = "c1") {
  return { id, owner_user_id: "p1", titulo: "Consulta", inicio: iso(de), fim: iso(ate), status, paciente: "Maria", paciente_id };
}

function montar(col: ColunaDoProfissional, extra: Partial<Parameters<typeof montarAgendaDoDia>[0]> = {}) {
  return montarAgendaDoDia({
    dia: DIA,
    fuso: FUSO,
    colunas: [col],
    visitas: new Map(),
    confirmacoes: new Map(),
    faltas: new Map(),
    fichas: new Map(),
    ...extra,
  })[0]!;
}

describe("status de exibição", () => {
  it("cancelado e faltou vencem o status da visita", () => {
    expect(statusDeExibicao("cancelled", "na_recepcao")).toBe("cancelado");
    expect(statusDeExibicao("no_show", "agendado")).toBe("faltou");
  });
  it("sem cancelamento nem falta, vale a visita; sem visita, agendado", () => {
    expect(statusDeExibicao("confirmed", "em_atendimento")).toBe("em_atendimento");
    expect(statusDeExibicao("pending", null)).toBe("agendado");
    expect(statusDeExibicao("pending", "lixo")).toBe("agendado");
  });
  it("realizado pela agenda sem visita registrada aparece como finalizado", () => {
    expect(statusDeExibicao("completed", null)).toBe("finalizado");
  });
  it("período: manhã < 12h ≤ tarde < 18h ≤ noite", () => {
    expect(periodoDoMinuto(11 * 60 + 59)).toBe("manha");
    expect(periodoDoMinuto(12 * 60)).toBe("tarde");
    expect(periodoDoMinuto(18 * 60)).toBe("noite");
  });
});

describe("agenda do dia", () => {
  it("minuto local no fuso da organização; fora do dia vira 0 ou 1440", () => {
    expect(minutoNoDia(iso("08:30"), DIA, FUSO)).toBe(510);
    expect(minutoNoDia(new Date("2026-09-30T23:00:00-04:00").toISOString(), DIA, FUSO)).toBe(0);
    expect(minutoNoDia(new Date("2026-10-02T01:00:00-04:00").toISOString(), DIA, FUSO)).toBe(1440);
  });

  it("jornada 8–10h com um compromisso 8:30–9h: 3 livres de 30 min, ocupação 30/120, disponível", () => {
    const b = montar(coluna({ compromissos: [compromisso("a1", "08:30", "09:00")] }));
    expect(b.estado).toBe("disponivel");
    expect(b.ocupacao).toEqual({ consultas: 1, minutos_ocupados: 30, minutos_abertos: 120, livres: 3 });
    expect(b.linhas.map((l) => `${l.tipo}@${l.inicio_minuto}`)).toEqual(["livre@480", "compromisso@510", "livre@540", "livre@570"]);
  });

  it("bloqueio tira minutos abertos e horários livres", () => {
    const b = montar(coluna({ bloqueios: [{ inicio_minuto: 540, fim_minuto: 600, motivo: "Almoço", origem: "pessoa" }] }));
    expect(b.ocupacao.minutos_abertos).toBe(60);
    expect(b.linhas.filter((l) => l.tipo === "livre")).toHaveLength(2);
  });

  it("dia todo bloqueado = bloqueado; sem jornada = fora da jornada; sem vaga = lotado", () => {
    expect(montar(coluna({ bloqueios: [{ inicio_minuto: 0, fim_minuto: 1440, motivo: "Férias", origem: "pessoa" }] })).estado).toBe("bloqueado");
    expect(montar(coluna({ jornada: [], compromissos: [compromisso("a1", "08:00", "08:30")] })).estado).toBe("fora_da_jornada");
    expect(montar(coluna({ compromissos: [compromisso("a1", "08:00", "10:00")] })).estado).toBe("lotado");
  });

  it("cancelado aparece na lista mas não ocupa o horário", () => {
    const b = montar(coluna({ compromissos: [compromisso("a1", "08:00", "10:00", "cancelled")] }));
    expect(b.ocupacao.consultas).toBe(0);
    expect(b.ocupacao.livres).toBe(4);
    expect(b.linhas.find((l) => l.tipo === "compromisso")).toMatchObject({ status: "cancelado" });
  });

  it("junta visita, confirmação e faltas do paciente na linha", () => {
    const b = montar(coluna({ compromissos: [compromisso("a1", "08:00", "08:30")] }), {
      visitas: new Map([["a1", { status: "na_recepcao", desde: "2026-10-01T12:05:00Z" }]]),
      confirmacoes: new Map([["a1", "confirmado"]]),
      faltas: new Map([["c1", 2]]),
    });
    expect(b.linhas[0]).toMatchObject({ status: "na_recepcao", desde: "2026-10-01T12:05:00Z", confirmacao: "confirmado", faltas: 2 });
  });

  it("hoje: horário livre que já passou fica marcado e não conta como vaga", () => {
    const b = montar(coluna({}), { agoraMinuto: 9 * 60 });
    expect(b.linhas.filter((l) => l.tipo === "livre" && l.passou)).toHaveLength(2);
    expect(b.ocupacao.livres).toBe(2);
  });

  it("conselho como a clínica escreve", () => {
    expect(textoDoConselho("CRM", "12345", "MS")).toBe("CRM 12345/MS");
    expect(textoDoConselho("outro", "55", null)).toBe("55");
    expect(textoDoConselho(null, "1", "MS")).toBeNull();
  });
});
