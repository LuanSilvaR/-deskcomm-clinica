import { describe, expect, it } from "vitest";

import { gerarPdfDoProntuario } from "@/lib/clinic/prontuario/pdf";

describe("pdf do prontuário (fumaça)", () => {
  it("gera um PDF válido com um atendimento", async () => {
    const buf = await gerarPdfDoProntuario({
      clinica: "Clínica Teste",
      paciente: "Pessoa Fictícia",
      nascimento: "1990-01-01",
      alergias: "Dipirona",
      alertas: null,
      emitidoEm: new Date().toISOString(),
      geradoPor: "teste@example.test",
      atendimentos: [
        {
          id: "a1",
          status: "finalizado",
          inicio: new Date().toISOString(),
          fim: new Date().toISOString(),
          profissional: "Profissional",
          servico: "Consulta",
          especialidade: null,
          formularios: {},
          evolucao: {
            id: "e1",
            versao: 1,
            status: "finalizado",
            resposta: "Boa resposta.",
            observacoes: null,
            intercorrencias: null,
            orientacoes: null,
            proxima_conduta: null,
          },
          conduta: null,
          procedimentos: [],
          adendos: [],
        },
      ],
      documentos: [],
      t: (s) => s,
      data: (iso) => iso,
    });
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(800);
  });
});
