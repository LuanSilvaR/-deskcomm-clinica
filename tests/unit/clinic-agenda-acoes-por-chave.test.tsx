/**
 * FORK clinic (agenda S6a, issue #69 — C14): sem a chave, o botão da lista NÃO aparece.
 *
 * `HistoricoDaAgenda` (core) desenha Remarcar/Cancelar cinzas quando falta o handler — é o
 * comportamento do upstream e continua sendo o default. Com `ocultarAcoesAusentes`, o que a
 * pessoa não pode fazer some. Sabotagem: ignorar a prop no componente deixa o 2º caso vermelho.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HistoricoDaAgenda } from "@/components/agenda/HistoricoDaAgenda";
import { PESSOAS } from "@/components/agenda/dados-de-mentira";
import type { Agendamento } from "@/components/agenda/tipos";

afterEach(cleanup);

const AGORA = new Date("2026-08-26T14:37:00.000Z");
const proximo: Agendamento = {
  id: "a1",
  titulo: "Consulta",
  quemSeraAtendido: "Paciente fictício",
  responsavelId: "ana",
  comeca: new Date(AGORA.getTime() + 120 * 60_000).toISOString(),
  termina: new Date(AGORA.getTime() + 150 * 60_000).toISOString(),
  tipo: "Consulta",
  origem: "ui",
  situacao: "confirmed",
};

describe("lista da agenda — ações por chave", () => {
  it("default (upstream): sem handler, Remarcar e Cancelar aparecem desabilitados", () => {
    render(<HistoricoDaAgenda agendamentos={[proximo]} pessoas={PESSOAS} agora={AGORA} />);
    expect(screen.getByTestId("remarcar-a1")).toBeDisabled();
    expect(screen.getByTestId("cancelar-a1")).toBeDisabled();
  });

  it("ocultarAcoesAusentes: sem handler, os botões não existem", () => {
    render(<HistoricoDaAgenda agendamentos={[proximo]} pessoas={PESSOAS} agora={AGORA} ocultarAcoesAusentes />);
    expect(screen.queryByTestId("remarcar-a1")).toBeNull();
    expect(screen.queryByTestId("cancelar-a1")).toBeNull();
  });

  it("ocultarAcoesAusentes: com o handler, o botão aparece habilitado", () => {
    render(
      <HistoricoDaAgenda
        agendamentos={[proximo]}
        pessoas={PESSOAS}
        agora={AGORA}
        ocultarAcoesAusentes
        onCancelar={() => undefined}
      />,
    );
    expect(screen.queryByTestId("remarcar-a1")).toBeNull();
    expect(screen.getByTestId("cancelar-a1")).toBeEnabled();
  });
});
