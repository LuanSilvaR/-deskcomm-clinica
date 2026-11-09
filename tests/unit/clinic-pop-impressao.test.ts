// @vitest-environment node
/**
 * FORK clinic (9015) — a impressão do POP gera um PDF A4 de verdade, no papel
 * timbrado único, e o texto lido DE VOLTA do arquivo tem o que o documento
 * precisa mostrar. Dados fictícios.
 */
import { describe, expect, it } from "vitest";

import { extractPdfText } from "@/lib/ai/rag/extractors/pdf";
import { dadosDaImpressaoDoPop, faixaDaVersao } from "@/lib/clinic/pops/impressao";
import { MODELO_PADRAO } from "@/lib/clinic/pops/modelo";
import { montarContextoDaMarca } from "@/lib/documentos/contexto-da-marca";
import { renderizarDocumento } from "@/lib/documentos/renderizar";

const base = {
  procedimento: "Toxina Botulínica",
  codigo: "POP-007",
  criado: { por: "Luan", em: "2026-09-24T17:30:00Z" },
  atualizado: { por: "Maria", em: "2026-09-25T12:15:00Z" },
  aprovado: { por: "Fulano", em: "2026-09-25T14:30:00Z" },
  impressoEm: new Date("2026-09-25T17:37:00Z"),
  fuso: "America/Campo_Grande",
  tag: "pt-BR",
};

const contexto = () =>
  montarContextoDaMarca({
    nomeDaMarca: "Clínica Ficticia",
    razaoSocial: "Clínica Ficticia Estética LTDA",
    cnpj: "11.222.333/0001-81",
    endereco: { logradouro: "Rua das Flores", numero: "100", cidade: "Campo Grande", uf: "MS", cep: "79000000" },
    corDaMarca: "#4b5320",
  });

async function textoDoPdf(buf: Buffer): Promise<string> {
  return (await extractPdfText(buf, { estrategia: "em-processo" })).replace(/\s+/g, " ");
}
/** Eyebrow e rótulos têm espaçamento entre letras: o extrator os devolve "P O P". */
const semEspacos = (t: string) => t.replace(/\s+/g, "");

describe("impressão do POP", () => {
  it("faixa: vigente não tem; substituída e rascunho têm, com o número", () => {
    expect(faixaDaVersao({ major: 2, minor: 0, status: "approved" })).toBeNull();
    expect(faixaDaVersao({ major: 1, minor: 0, status: "superseded" })).toBe("VERSÃO 1.0 — SUBSTITUÍDA — NÃO VIGENTE");
    expect(faixaDaVersao({ major: 1, minor: 1, status: "draft" })).toContain("RASCUNHO");
  });

  it("PDF da versão vigente: timbrado, POP, código, versão, criação/atualização/aprovação, paginação e conteúdo", async () => {
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
    const buf = await renderizarDocumento(
      dadosDaImpressaoDoPop({ ...base, versao: { major: 2, minor: 0, status: "approved" }, conteudo }),
      await contexto(),
    );
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    const texto = await textoDoPdf(buf);
    for (const esperado of [
      "Clínica Ficticia",
      "Clínica Ficticia Estética LTDA",
      "CNPJ 11.222.333/0001-81",
      "Rua das Flores, 100",
      "Campo Grande – MS · 79000-000",
      "Toxina Botulínica",
      "POP-007",
      "2.0 · Aprovado",
      "Luan",
      "Maria",
      "Fulano",
      "1. IDENTIFICAÇÃO",
      "21. CONTROLE DE REVISÕES",
      "assepsia com clorexidina",
      "Seringa de insulina",
      "Página depois da quebra.",
      "Página 1 de",
    ]) {
      expect(texto, esperado).toContain(esperado);
    }
    expect(semEspacos(texto)).toContain(semEspacos("PROCEDIMENTO OPERACIONAL PADRÃO  ·  Nº POP-007 · V2.0"));
    expect(semEspacos(texto)).toContain("IMPRESSOEM");
    expect(texto).not.toContain("NÃO VIGENTE");
    const total = Number(/Página 1 de (\d+)/.exec(texto)?.[1]);
    expect(total).toBeGreaterThan(1);
    expect(texto).toContain(`Página ${total} de ${total}`);
  }, 60_000);

  it("PDF de versão substituída deixa claro, em TODAS as páginas, que NÃO é a vigente", async () => {
    const buf = await renderizarDocumento(
      dadosDaImpressaoDoPop({
        ...base,
        versao: { major: 1, minor: 0, status: "superseded" },
        conteudo: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Texto antigo." }] },
            { type: "quebraDePagina" },
            { type: "paragraph", content: [{ type: "text", text: "Segunda página." }] },
          ],
        },
      }),
      await contexto(),
    );
    const texto = await textoDoPdf(buf);
    // bloco de abertura + uma linha por página (2 páginas) = 3 ocorrências
    expect(texto.split("VERSÃO 1.0 — SUBSTITUÍDA — NÃO VIGENTE").length - 1).toBeGreaterThanOrEqual(3);
    expect(texto).toContain("1.0 · Substituído");
  }, 60_000);
});
