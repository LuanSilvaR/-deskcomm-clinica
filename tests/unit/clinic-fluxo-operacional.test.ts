import { describe, expect, it } from "vitest";

import { ehPrimeiraVez, ultimoFoiRemarcar } from "@/lib/clinic/agenda/primeira-vez";
import { statusDeExibicao, visitaDaExibicao } from "@/lib/clinic/visitas/exibicao";
import { ACAO_PARA_AVANCAR, podeAvancar } from "@/lib/clinic/visitas/status";

/**
 * Agenda S4 — fluxo recepção → profissional. As regras de TELA (qual status
 * aparece, quem vê qual botão, 1ª vez, remarcado) são puras e testadas aqui; a
 * regra de SEGURANÇA (quem pode cada transição) mora no banco (migration 9043)
 * e é provada nos invariantes.
 */

describe("statusDeExibicao — só o último status, com confirmado e remarcado", () => {
  it("antes da chegada: agendado, confirmado (núcleo ou resposta) e remarcado", () => {
    expect(statusDeExibicao("pending", null)).toBe("agendado");
    expect(statusDeExibicao("confirmed", null)).toBe("confirmado");
    expect(statusDeExibicao("pending", null, { confirmacao: "confirmado" })).toBe("confirmado");
    expect(statusDeExibicao("confirmed", null, { remarcado: true })).toBe("remarcado");
    expect(statusDeExibicao("pending", "agendado", { remarcado: true })).toBe("remarcado");
  });
  it("depois da chegada, a visita manda", () => {
    expect(statusDeExibicao("confirmed", "na_recepcao", { remarcado: true })).toBe("na_recepcao");
    expect(statusDeExibicao("confirmed", "pronto")).toBe("pronto");
    expect(statusDeExibicao("confirmed", "em_atendimento")).toBe("em_atendimento");
    expect(statusDeExibicao("completed", "finalizado")).toBe("finalizado");
  });
  it("cancelado e faltou são o fim da história e vencem tudo", () => {
    expect(statusDeExibicao("cancelled", "pronto", { confirmacao: "confirmado" })).toBe("cancelado");
    expect(statusDeExibicao("no_show", null, { remarcado: true })).toBe("faltou");
  });
  it("realizado pela agenda sem visita aparece finalizado", () => {
    expect(statusDeExibicao("completed", null)).toBe("finalizado");
  });
});

describe("visitaDaExibicao — confirmado/remarcado ainda são 'agendado' para a visita", () => {
  it("o botão 'Iniciar recepção' continua aparecendo para confirmado e remarcado", () => {
    for (const s of ["agendado", "confirmado", "remarcado"] as const) {
      expect(visitaDaExibicao(s)).toBe("agendado");
      expect(ACAO_PARA_AVANCAR[visitaDaExibicao(s)!]?.rotulo).toBe("Iniciar recepção");
    }
    expect(visitaDaExibicao("cancelado")).toBeNull();
    expect(visitaDaExibicao("pronto")).toBe("pronto");
  });
});

describe("podeAvancar — recepção leva até 'pronto'; iniciar e finalizar só o profissional", () => {
  const recepcao = { ehODono: false, podeRecepcao: true };
  const dono = { ehODono: true, podeRecepcao: false };
  const outroProfissional = { ehODono: false, podeRecepcao: false };
  it("recepção: chegada e pronto sim; iniciar e finalizar não", () => {
    expect(podeAvancar(ACAO_PARA_AVANCAR.agendado, recepcao)).toBe(true);
    expect(podeAvancar(ACAO_PARA_AVANCAR.na_recepcao, recepcao)).toBe(true);
    expect(podeAvancar(ACAO_PARA_AVANCAR.pronto, recepcao)).toBe(false);
    expect(podeAvancar(ACAO_PARA_AVANCAR.em_atendimento, recepcao)).toBe(false);
  });
  it("profissional do agendamento: inicia e finaliza", () => {
    expect(podeAvancar(ACAO_PARA_AVANCAR.pronto, dono)).toBe(true);
    expect(podeAvancar(ACAO_PARA_AVANCAR.em_atendimento, dono)).toBe(true);
  });
  it("outro profissional: nada", () => {
    expect(podeAvancar(ACAO_PARA_AVANCAR.pronto, outroProfissional)).toBe(false);
    expect(podeAvancar(ACAO_PARA_AVANCAR.agendado, outroProfissional)).toBe(false);
  });
  it("finalizado não tem próximo passo", () => {
    expect(podeAvancar(ACAO_PARA_AVANCAR.finalizado, dono)).toBe(false);
  });
});

describe("1ª vez e remarcado", () => {
  it("1ª vez = nenhum realizado ANTES deste compromisso", () => {
    expect(ehPrimeiraVez("2026-10-08T12:00:00Z", undefined)).toBe(true);
    expect(ehPrimeiraVez("2026-10-08T12:00:00Z", "2026-09-01T12:00:00Z")).toBe(false);
    // o próprio compromisso já realizado não tira a 1ª vez dele
    expect(ehPrimeiraVez("2026-10-08T12:00:00Z", "2026-10-08T12:00:00Z")).toBe(true);
  });
  it("remarcado vale até alguém confirmar de novo", () => {
    expect(ultimoFoiRemarcar([])).toBe(false);
    expect(ultimoFoiRemarcar([{ tipo: "remarcado", created_at: "2026-10-01T10:00:00Z" }])).toBe(true);
    expect(
      ultimoFoiRemarcar([
        { tipo: "remarcado", created_at: "2026-10-01T10:00:00Z" },
        { tipo: "confirmado", created_at: "2026-10-02T10:00:00Z" },
      ]),
    ).toBe(false);
    expect(
      ultimoFoiRemarcar([
        { tipo: "confirmado", created_at: "2026-10-01T10:00:00Z" },
        { tipo: "criado", created_at: "2026-10-03T10:00:00Z" },
        { tipo: "remarcado", created_at: "2026-10-02T10:00:00Z" },
      ]),
    ).toBe(true);
  });
});
