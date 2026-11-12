import { describe, expect, it } from "vitest";

import { rotuloDaFalhaDoLembrete } from "./status";

describe("rotuloDaFalhaDoLembrete (#83)", () => {
  it("erro com tentativas sobrando: rótulo neutro com a contagem", () => {
    expect(rotuloDaFalhaDoLembrete("erro_apos_tentativas", 1)).toBe("Lembrete não saiu — tentando de novo (1/3)");
    expect(rotuloDaFalhaDoLembrete("erro_apos_tentativas", 2)).toBe("Lembrete não saiu — tentando de novo (2/3)");
  });

  it("erro com as 3 tentativas gastas: pede ligação", () => {
    expect(rotuloDaFalhaDoLembrete("erro_apos_tentativas", 3)).toBe("Lembrete não saiu após 3 tentativas — ligar");
  });

  it("sem a contagem, não afirma tentativa em curso", () => {
    expect(rotuloDaFalhaDoLembrete("erro_apos_tentativas", null)).toBe("Lembrete não saiu após 3 tentativas — ligar");
  });

  it("os outros motivos mantêm o rótulo, com qualquer contagem", () => {
    expect(rotuloDaFalhaDoLembrete("sem_caminho", 1)).toBe("Lembrete não saiu: nenhum número conectado — ligar");
    expect(rotuloDaFalhaDoLembrete("meta_sem_modelo", 1)).toBe("Lembrete não saiu: janela fechada e sem modelo aprovado — ligar");
    expect(rotuloDaFalhaDoLembrete("fora_do_horario", 0)).toBe("Lembrete aguardando o horário de envio");
    expect(rotuloDaFalhaDoLembrete("envio_nao_confirmado", 1)).toBe("Lembrete com envio não confirmado — conferir");
  });
});
