// #83: um aviso só — sem pedido de confirmação, o selo mostra por que o lembrete não saiu.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));

import { SeloDaConfirmacao } from "./SeloDaConfirmacao";

describe("SeloDaConfirmacao — motivo do lembrete com reserva", () => {
  it("selo mostra o motivo do lembrete sem pedido de confirmação", () => {
    render(<SeloDaConfirmacao status={null} falhaDoLembrete="sem_caminho" />);
    const selo = screen.getByTestId("selo-da-confirmacao");
    expect(selo.textContent).toBe("Lembrete não saiu: nenhum número conectado — ligar");
    expect(selo.getAttribute("data-falha-do-lembrete")).toBe("sem_caminho");
    expect(selo.className).toContain("text-warning");
  });

  it("fora do horário é espera, não problema (estilo apagado)", () => {
    render(<SeloDaConfirmacao status={null} falhaDoLembrete="fora_do_horario" />);
    expect(screen.getByTestId("selo-da-confirmacao").className).toContain("text-text-muted");
  });

  it("falha da 9006 vence quando há pedido", () => {
    render(<SeloDaConfirmacao status="sem_resposta" falha="nao_enviado" falhaDoLembrete="sem_caminho" />);
    const selo = screen.getByTestId("selo-da-confirmacao");
    expect(selo.textContent).toBe("Lembrete não saiu — ligar");
    expect(selo.getAttribute("data-falha-do-lembrete")).toBeNull();
  });

  it("valor fora do vocabulário ou ausente não mostra nada", () => {
    const { container } = render(<SeloDaConfirmacao status={null} falhaDoLembrete="qualquer" />);
    expect(container.innerHTML).toBe("");
  });
  it("erro com tentativas sobrando: rótulo neutro, sem pedir ligação", () => {
    render(<SeloDaConfirmacao status={null} falhaDoLembrete="erro_apos_tentativas" tentativasDoLembrete={1} />);
    const selo = screen.getByTestId("selo-da-confirmacao");
    expect(selo.textContent).toBe("Lembrete não saiu — tentando de novo (1/3)");
    expect(selo.className).toContain("text-text-muted");
  });

  it("erro com as 3 tentativas gastas: pede ligação", () => {
    render(<SeloDaConfirmacao status={null} falhaDoLembrete="erro_apos_tentativas" tentativasDoLembrete={3} />);
    const selo = screen.getByTestId("selo-da-confirmacao");
    expect(selo.textContent).toBe("Lembrete não saiu após 3 tentativas — ligar");
    expect(selo.className).toContain("text-warning");
  });
});
