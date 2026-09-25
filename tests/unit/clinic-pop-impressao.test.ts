// @vitest-environment node
/**
 * FORK clinic (9015) — a impressão do POP gera um PDF A4 de verdade, e o texto
 * lido DE VOLTA do arquivo tem o que o documento precisa mostrar.
 */
import { describe, expect, it } from "vitest";

import { extractPdfText } from "@/lib/ai/rag/extractors/pdf";
import { dadosDaImpressaoDoPop, faixaDaVersao } from "@/lib/clinic/pops/impressao";
import { MODELO_PADRAO } from "@/lib/clinic/pops/modelo";
import { paraWinAnsi, renderizarDocumento } from "@/lib/documentos/renderizar";

const base = {
  marca: { nome: "Clínica Farias Rocha", razaoSocial: "Farias Rocha Estética LTDA", cnpj: "12.345.678/0001-90", endereco: "Rua das Flores, 100 — Campo Grande/MS", cor: "#4b5320" },
  procedimento: "Toxina Botulínica",
  codigo: "POP-007",
  criado: { por: "Luan", em: "2026-09-24T17:30:00Z" },
  atualizado: { por: "Maria", em: "2026-09-25T12:15:00Z" },
  aprovado: { por: "Fulano", em: "2026-09-25T14:30:00Z" },
  impressoEm: new Date("2026-09-25T17:37:00Z"),
  fuso: "America/Campo_Grande",
  tag: "pt-BR",
};

async function textoDoPdf(buf: Buffer): Promise<string> {
  return (await extractPdfText(buf, { estrategia: "em-processo" })).replace(/\s+/g, " ");
}

describe("impressão do POP", () => {
  it("faixa: vigente não tem; substituída e rascunho têm, com o número", () => {
    expect(faixaDaVersao({ major: 2, minor: 0, status: "approved" })).toBeNull();
    expect(faixaDaVersao({ major: 1, minor: 0, status: "superseded" })).toBe("VERSÃO 1.0 — SUBSTITUÍDA — NÃO VIGENTE");
    expect(faixaDaVersao({ major: 1, minor: 1, status: "draft" })).toContain("RASCUNHO");
  });

  it("caractere fora da fonte vira ?, acentos ficam", () => {
    expect(paraWinAnsi("Ação ç ã é — “x” 😀")).toBe("Ação ç ã é — “x” ?");
  });

  it("PDF da versão vigente: marca, POP, código, versão, status, criação/atualização/aprovação, paginação e conteúdo", async () => {
    const conteudo = {
      type: "doc",
      content: [
        ...MODELO_PADRAO.content,
        { type: "paragraph", content: [{ type: "text", text: "Aplicação com agulha 30G — assepsia com clorexidina.", marks: [{ type: "bold" }] }] },
        {
          type: "table",
          content: [
            { type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Material" }] }] }] },
            { type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Seringa de insulina" }] }] }] },
          ],
        },
        { type: "quebraDePagina" },
        { type: "paragraph", content: [{ type: "text", text: "Página depois da quebra." }] },
      ],
    };
    const buf = await renderizarDocumento(dadosDaImpressaoDoPop({ ...base, versao: { major: 2, minor: 0, status: "approved" }, conteudo }));
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    const texto = await textoDoPdf(buf);
    for (const esperado of [
      "Clínica Farias Rocha",
      "CNPJ 12.345.678/0001-90",
      "PROCEDIMENTO OPERACIONAL PADRÃO — POP",
      "Toxina Botulínica",
      "POP-007",
      "APROVADO",
      "Luan",
      "Maria",
      "Fulano",
      "1. IDENTIFICAÇÃO",
      "21. CONTROLE DE REVISÕES",
      "assepsia com clorexidina",
      "Seringa de insulina",
      "Página depois da quebra.",
      "POP-007 | Versão 2.0 | Página 1 de",
      "Impresso em",
    ]) {
      expect(texto, esperado).toContain(esperado);
    }
    expect(texto).not.toContain("NÃO VIGENTE");
    // A quebra de página e o modelo inteiro dão mais de uma página; a última se identifica.
    const total = Number(/Página 1 de (\d+)/.exec(texto)?.[1]);
    expect(total).toBeGreaterThan(1);
    expect(texto).toContain(`Página ${total} de ${total}`);
  }, 60_000);

  it("PDF de versão substituída deixa claro que NÃO é a vigente", async () => {
    const buf = await renderizarDocumento(
      dadosDaImpressaoDoPop({ ...base, versao: { major: 1, minor: 0, status: "superseded" }, conteudo: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Texto antigo." }] }] } }),
    );
    const texto = await textoDoPdf(buf);
    expect(texto).toContain("VERSÃO 1.0 — SUBSTITUÍDA — NÃO VIGENTE");
    expect(texto).toContain("SUBSTITUÍDO");
  }, 60_000);
});
