import { describe, expect, it } from "vitest";

import { minutosDeEspera, montarFila, secaoDoStatus, type ItemDaFila } from "./fila";

const agora = new Date("2026-10-01T15:00:00Z");

function item(id: string, extra: Partial<ItemDaFila> = {}): ItemDaFila {
  return {
    appointment_id: id,
    inicio: "2026-10-01T14:00:00Z",
    fim: "2026-10-01T14:30:00Z",
    paciente_id: `p-${id}`,
    paciente: `Paciente ${id}`,
    servico: null,
    profissional_id: null,
    status: "agendado",
    chegou_em: null,
    pronto_em: null,
    atendimento_id: null,
    ...extra,
  };
}

describe("fila de atendimentos", () => {
  it("cada status cai na seção certa", () => {
    expect(secaoDoStatus("agendado")).toBe("proximos");
    expect(secaoDoStatus("na_recepcao")).toBe("aguardando");
    expect(secaoDoStatus("pronto")).toBe("aguardando");
    expect(secaoDoStatus("em_atendimento")).toBe("em_atendimento");
    expect(secaoDoStatus("finalizado")).toBe("finalizados");
  });

  it("espera conta desde 'pronto'; sem pronto, desde a chegada; sem nenhum, nada", () => {
    expect(minutosDeEspera({ pronto_em: "2026-10-01T14:48:00Z", chegou_em: "2026-10-01T14:30:00Z" }, agora)).toBe(12);
    expect(minutosDeEspera({ pronto_em: null, chegou_em: "2026-10-01T14:30:00Z" }, agora)).toBe(30);
    expect(minutosDeEspera({ pronto_em: null, chegou_em: null }, agora)).toBeNull();
    expect(minutosDeEspera({ pronto_em: "2026-10-01T16:00:00Z", chegou_em: null }, agora)).toBe(0);
  });

  it("aguardando: quem espera há mais tempo primeiro; demais seções por horário", () => {
    const fila = montarFila(
      [
        item("a", { status: "pronto", pronto_em: "2026-10-01T14:55:00Z" }),
        item("b", { status: "na_recepcao", chegou_em: "2026-10-01T14:20:00Z" }),
        item("c", { inicio: "2026-10-01T16:00:00Z" }),
        item("d", { inicio: "2026-10-01T15:30:00Z" }),
        item("e", { status: "em_atendimento" }),
        item("f", { status: "finalizado", inicio: "2026-10-01T09:00:00Z" }),
      ],
      agora,
    );
    expect(fila.aguardando.map((i) => [i.appointment_id, i.espera_min])).toEqual([
      ["b", 40],
      ["a", 5],
    ]);
    expect(fila.proximos.map((i) => i.appointment_id)).toEqual(["d", "c"]);
    expect(fila.em_atendimento.map((i) => i.appointment_id)).toEqual(["e"]);
    expect(fila.finalizados.map((i) => i.appointment_id)).toEqual(["f"]);
    expect(fila.proximos.every((i) => i.espera_min === null)).toBe(true);
  });
});
