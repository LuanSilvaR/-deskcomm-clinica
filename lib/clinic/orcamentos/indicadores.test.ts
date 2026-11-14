import { describe, expect, it } from "vitest";

import { calcularIndicadores, intervaloDoMes, type LinhaDoIndicador } from "./indicadores";

const { de, ate } = intervaloDoMes("2026-11");
const l = (o: Partial<LinhaDoIndicador>): LinhaDoIndicador => ({
  status: "enviado",
  total_cents: 10000,
  enviado_em: null,
  aprovado_em: null,
  recusado_em: null,
  expirado_em: null,
  ...o,
});

describe("indicadores do mês", () => {
  it("intervalo do mês: de inclusivo, até exclusivo", () => {
    expect(intervaloDoMes("2026-12")).toEqual({ de: "2026-12-01T00:00:00.000Z", ate: "2027-01-01T00:00:00.000Z" });
  });

  it("conversão na mesma coorte; valor e ticket pelos aprovados do mês; substituída não conta", () => {
    const i = calcularIndicadores(
      [
        l({ status: "aprovado", total_cents: 150000, enviado_em: "2026-11-02T10:00:00Z", aprovado_em: "2026-11-03T10:00:00Z" }),
        l({ status: "aprovado", total_cents: 50000, enviado_em: "2026-10-28T10:00:00Z", aprovado_em: "2026-11-01T09:00:00Z" }),
        l({ status: "enviado", enviado_em: "2026-11-10T10:00:00Z" }),
        l({ status: "recusado", enviado_em: "2026-11-05T10:00:00Z", recusado_em: "2026-11-06T10:00:00Z" }),
        l({ status: "substituido", enviado_em: "2026-11-04T10:00:00Z" }),
        l({ status: "expirado", enviado_em: "2026-10-01T10:00:00Z", expirado_em: "2026-11-01T00:41:00Z" }),
        l({ status: "rascunho" }),
      ],
      de,
      ate,
    );
    expect(i).toEqual({
      enviados: 3,
      aprovados_dos_enviados: 1,
      conversao_pct: 33.3,
      aprovados: 2,
      valor_aprovado_cents: 200000,
      ticket_medio_cents: 100000,
      recusados: 1,
      expirados: 1,
      em_aberto: 1,
    });
  });

  it("sem envio: conversão e ticket vazios, nunca divisão por zero", () => {
    const i = calcularIndicadores([], de, ate);
    expect(i.conversao_pct).toBeNull();
    expect(i.ticket_medio_cents).toBeNull();
  });
});
