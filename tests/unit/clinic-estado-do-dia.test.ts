import { describe, expect, it } from "vitest";

import { estadoDoDia } from "@/lib/clinic/agenda/estado-do-dia";

const j = (a: number, b: number) => ({ inicio_minuto: a * 60, fim_minuto: b * 60 });

describe("estado do dia no painel de marcação (#68)", () => {
  it("sem jornada: Sem agenda", () => {
    expect(estadoDoDia({ jornada: [], bloqueios: [], livres: 5 })).toBe("sem_agenda");
  });
  it("bloqueio cobrindo toda a jornada (em pedaços): Bloqueado", () => {
    expect(estadoDoDia({ jornada: [j(8, 12), j(14, 18)], bloqueios: [j(7, 12), j(14, 16), j(15, 19)], livres: null })).toBe("bloqueado");
  });
  it("jornada com sobra e nenhum horário livre: Lotado", () => {
    expect(estadoDoDia({ jornada: [j(8, 12)], bloqueios: [j(8, 9)], livres: 0 })).toBe("lotado");
  });
  it("com horário livre, ou lista ainda não carregada: Disponível", () => {
    expect(estadoDoDia({ jornada: [j(8, 12)], bloqueios: [], livres: 3 })).toBe("disponivel");
    expect(estadoDoDia({ jornada: [j(8, 12)], bloqueios: [], livres: null })).toBe("disponivel");
  });
  it("sabotagem: bloqueio que deixa 1 minuto não é Bloqueado", () => {
    expect(estadoDoDia({ jornada: [j(8, 12)], bloqueios: [{ inicio_minuto: 8 * 60, fim_minuto: 12 * 60 - 1 }], livres: null })).toBe("disponivel");
  });
});
