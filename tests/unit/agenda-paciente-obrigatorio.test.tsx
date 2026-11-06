/**
 * FORK clinic — agendamento SEM PACIENTE não existe.
 *
 * O painel recebe a `pendencia` ("Escolha o paciente antes de confirmar.") e,
 * com ela, o "Confirmar" fica desabilitado e a frase aparece acima dele. A rota
 * recusa do mesmo jeito (`agenda_sem_paciente`, ver agenda-emite-atividade).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PainelDeMarcacao } from "@/components/agenda/PainelDeMarcacao";
import type { HorarioLivre, Pessoa } from "@/components/agenda/tipos";

afterEach(cleanup);

const AGORA = new Date("2026-09-15T12:00:00");
const RESPONSAVEL: Pessoa = { id: "p1", nome: "Ana", trilha: 1 };
const HORARIO: HorarioLivre = { instante: "2026-09-16T13:00:00.000Z", rotulo: "10:00" };

function montar(pendencia?: string) {
  const onConfirmar = vi.fn(async (_instante: string, _duracaoMin?: number) => undefined);
  render(
    <PainelDeMarcacao
      ancora={AGORA}
      agora={AGORA}
      responsavel={RESPONSAVEL}
      fuso="America/Sao_Paulo"
      horariosPorDia={{ "2026-09-16": [HORARIO] }}
      horarioInicial={HORARIO}
      pendencia={pendencia}
      onConfirmar={onConfirmar}
    />,
  );
  return { onConfirmar };
}

describe("o paciente é obrigatório para confirmar", () => {
  it("⭐ sem paciente: Confirmar desabilitado, aviso visível e nada é enviado", () => {
    const { onConfirmar } = montar("Escolha o paciente antes de confirmar.");
    const confirmar = screen.getByTestId("confirmar-marcacao");
    expect(confirmar).toBeDisabled();
    expect(screen.getByTestId("pendencia-da-marcacao")).toHaveTextContent("Escolha o paciente antes de confirmar.");
    fireEvent.click(confirmar);
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("com paciente: Confirmar ativo e sem aviso", () => {
    const { onConfirmar } = montar(undefined);
    expect(screen.queryByTestId("pendencia-da-marcacao")).toBeNull();
    fireEvent.click(screen.getByTestId("confirmar-marcacao"));
    expect(onConfirmar.mock.calls[0]?.[0]).toBe(HORARIO.instante);
  });
});
