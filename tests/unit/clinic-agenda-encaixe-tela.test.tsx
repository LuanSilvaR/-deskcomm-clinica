/**
 * FORK clinic (agenda S6b, issue #69) — a tela do encaixe.
 * O 409 mostra quem ocupa; "Encaixar" só com a chave E com `pode_encaixar`, e exige motivo 5–500;
 * a etiqueta "Encaixe" só aparece quando a prop opcional é passada.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HistoricoDaAgenda } from "@/components/agenda/HistoricoDaAgenda";
import type { Agendamento, Pessoa } from "@/components/agenda/tipos";
import { DetalheDoEncaixe } from "@/components/clinic/agenda/DetalheDoEncaixe";
import { HorarioOcupadoEEncaixe, type HorarioOcupado } from "@/components/clinic/agenda/HorarioOcupadoEEncaixe";

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/i18n/useLocaleDeData", () => ({
  useTagDeIdioma: () => "pt-BR",
  useLocaleDeData: () => undefined,
}));

function envolver(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const ocupado: HorarioOcupado = {
  pode_encaixar: true,
  agendamentos: [
    { id: "a1", paciente: "Paciente Teste", inicio: "2026-11-10T13:00:00.000Z", fim: "2026-11-10T14:00:00.000Z", status: "confirmed" },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("HorarioOcupadoEEncaixe", () => {
  it("lista quem ocupa o horário", () => {
    render(<HorarioOcupadoEEncaixe ocupado={ocupado} podeEncaixar={false} onEncaixar={vi.fn()} />);
    expect(screen.getByText("Horário ocupado")).toBeTruthy();
    expect(screen.getByTestId("ocupante-do-horario").textContent).toContain("Paciente Teste");
    expect(screen.getByTestId("ocupante-do-horario").textContent).toContain("Confirmado");
  });

  it("sem a chave não oferece Encaixar", () => {
    render(<HorarioOcupadoEEncaixe ocupado={ocupado} podeEncaixar={false} onEncaixar={vi.fn()} />);
    expect(screen.queryByTestId("encaixar")).toBeNull();
  });

  it("sem pode_encaixar do servidor não oferece Encaixar, mesmo com a chave", () => {
    render(<HorarioOcupadoEEncaixe ocupado={{ ...ocupado, pode_encaixar: false }} podeEncaixar onEncaixar={vi.fn()} />);
    expect(screen.queryByTestId("encaixar")).toBeNull();
  });

  it("com a chave exige o motivo (5–500) antes de enviar", async () => {
    const user = userEvent.setup();
    const onEncaixar = vi.fn();
    render(<HorarioOcupadoEEncaixe ocupado={ocupado} podeEncaixar onEncaixar={onEncaixar} />);
    await user.click(screen.getByTestId("encaixar"));
    const confirmar = screen.getByTestId("confirmar-encaixe") as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    await user.type(screen.getByLabelText("Motivo do encaixe"), "abc");
    expect(confirmar.disabled).toBe(true);
    await user.type(screen.getByLabelText("Motivo do encaixe"), "def");
    expect(confirmar.disabled).toBe(false);
    await user.click(confirmar);
    expect(onEncaixar).toHaveBeenCalledWith("abcdef");
  });
});

describe("etiqueta Encaixe", () => {
  const pessoas: Pessoa[] = [];
  const ag: Agendamento = {
    id: "ag-1",
    titulo: "Consulta",
    quemSeraAtendido: "Paciente Teste",
    responsavelId: "u1",
    comeca: "2099-01-01T13:00:00.000Z",
    termina: "2099-01-01T14:00:00.000Z",
    origem: "ui",
    situacao: "confirmed",
  } as Agendamento;

  it("aparece só com a prop etiquetas", () => {
    const { unmount } = render(<HistoricoDaAgenda agendamentos={[ag]} pessoas={pessoas} agora={new Date("2098-12-01")} />);
    expect(screen.queryByTestId("etiqueta-do-compromisso")).toBeNull();
    unmount();
    render(
      <HistoricoDaAgenda agendamentos={[ag]} pessoas={pessoas} agora={new Date("2098-12-01")} etiquetas={{ "ag-1": "Encaixe" }} />,
    );
    expect(screen.getByTestId("etiqueta-do-compromisso").textContent).toBe("Encaixe");
  });
});

describe("DetalheDoEncaixe", () => {
  it("mostra motivo e autor quando é encaixe", async () => {
    get.mockResolvedValue({
      data: { encaixe: { motivo: "Retorno urgente", autor: { id: "u", nome: "Gerente Teste" }, quando: "2026-11-04T12:00:00.000Z" } },
    });
    envolver(<DetalheDoEncaixe appointmentId="ag-1" />);
    await waitFor(() => expect(screen.getByTestId("detalhe-do-encaixe")).toBeTruthy());
    expect(screen.getByTestId("detalhe-do-encaixe").textContent).toContain("Retorno urgente");
    expect(screen.getByTestId("detalhe-do-encaixe").textContent).toContain("Gerente Teste");
  });

  it("não desenha nada quando não é encaixe", async () => {
    get.mockResolvedValue({ data: { encaixe: null } });
    envolver(<DetalheDoEncaixe appointmentId="ag-2" />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.queryByTestId("detalhe-do-encaixe")).toBeNull();
  });
});
