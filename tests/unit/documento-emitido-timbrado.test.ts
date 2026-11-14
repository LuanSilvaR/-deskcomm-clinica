// @vitest-environment node
/**
 * FORK clinic (papel timbrado D3) — o documento emitido no papel timbrado:
 * texto congelado vira blocos, situação e aceite nos metadados, revogado e
 * cancelado avisam em todas as páginas. E o PDF sai de verdade. Dados fictícios.
 */
import { describe, expect, it } from "vitest";

import { extractPdfText } from "@/lib/ai/rag/extractors/pdf";
import { documentoEmitidoParaTimbrado, textoParaBlocos, type DocumentoEmitido } from "@/lib/clinic/documentos/timbrado";
import { comCoresAtuais, montarContextoDaMarca, type SnapshotDaMarca } from "@/lib/documentos/contexto-da-marca";
import { renderizarDocumento } from "@/lib/documentos/renderizar";

const fmt = { data: (iso: string) => iso.slice(0, 10), dataHora: (iso: string) => iso.slice(0, 16).replace("T", " ") };

const BASE: DocumentoEmitido = {
  id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  tipo: "consentimento",
  titulo: "Termo de consentimento — Toxina",
  conteudo: "# Termo\n\nEu, paciente ficticia, declaro que fui informada.\n\n## Riscos\n- Hematoma\n- Edema\n\nTexto final.",
  sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  status: "aceito",
  criadoEm: "2026-11-08T12:00:00Z",
  validadeAte: null,
  paciente: "Paciente Ficticia",
  aceite: { nome: "Paciente Ficticia", canal: "link", em: "2026-11-08T13:00:00Z" },
  revogacao: null,
};

describe("documento emitido → papel timbrado", () => {
  it("texto congelado vira títulos, parágrafos e lista", () => {
    const b = textoParaBlocos(BASE.conteudo).content!;
    expect(b.map((n) => n.type)).toEqual(["heading", "paragraph", "heading", "bulletList", "paragraph"]);
    expect(b[3]!.content).toHaveLength(2);
  });

  it("aceito: situação, aceite e integridade nos metadados; registro do aceite no corpo", () => {
    const d = documentoEmitidoParaTimbrado(BASE, fmt);
    expect(d.tipo).toBe("Termo de consentimento");
    const meta = Object.fromEntries(d.metadados!.filter((m) => m[1]));
    expect(meta.Situação).toBe("Aceito");
    expect(meta.Aceite).toContain("Paciente Ficticia");
    expect(meta.Integridade).toContain("SHA-256 0123456789abcdef");
    expect(JSON.stringify(d.corpo)).toContain("Lei 14.063/2020");
    expect(d.avisos).toEqual([]);
  });

  it("revogado e cancelado avisam em todas as páginas", () => {
    const rev = documentoEmitidoParaTimbrado({ ...BASE, status: "revogado", revogacao: { em: "2026-11-09T10:00:00Z", motivo: null } }, fmt);
    expect(rev.avisos?.[0]).toMatchObject({ estado: "perigo", emTodasAsPaginas: true });
    expect(rev.avisos?.[0]?.texto).toContain("REVOGADO");
    const can = documentoEmitidoParaTimbrado({ ...BASE, status: "cancelado", aceite: null }, fmt);
    expect(can.avisos?.[0]?.texto).toContain("CANCELADO");
  });

  it("contrato leva o número informado (o do orçamento) no eyebrow", () => {
    expect(documentoEmitidoParaTimbrado({ ...BASE, tipo: "contrato", numero: "007" }, fmt).numero).toBe("007");
  });

  it("gera o PDF com o texto, o paciente e o aceite", async () => {
    const ctx = await montarContextoDaMarca({ nomeDaMarca: "Clinica Ficticia", corDaMarca: "#8F5A4A" });
    const buf = await renderizarDocumento(documentoEmitidoParaTimbrado(BASE, fmt), ctx);
    const texto = (await extractPdfText(buf, { estrategia: "em-processo" })).replace(/\s+/g, " ");
    for (const esperado of ["Termo de consentimento — Toxina", "declaro que fui informada", "Hematoma", "Paciente Ficticia", "Lei 14.063/2020"]) {
      expect(texto, esperado).toContain(esperado);
    }
  }, 60_000);
});

describe("#126: termo já emitido segue as CORES de agora, o resto continua congelado", () => {
  const snapshot = {
    nomeDaMarca: "Clinica Ficticia",
    razaoSocial: "Clinica Ficticia LTDA",
    corDaMarca: "#8f5a4a",
    corDosFiletes: null,
    logoPath: "org/logo-antigo.png",
    faviconPath: null,
  } as SnapshotDaMarca;

  it("troca só corDaMarca e corDosFiletes", () => {
    const r = comCoresAtuais(snapshot, { corDaMarca: "#8f5a4a", corDosFiletes: "#5d4b91" });
    expect(r.corDosFiletes).toBe("#5d4b91");
    expect(r.nomeDaMarca).toBe("Clinica Ficticia");
    expect(r.razaoSocial).toBe("Clinica Ficticia LTDA");
    expect(r.logoPath).toBe("org/logo-antigo.png");
  });

  it("cor apagada nas Configurações some também do termo antigo", () => {
    expect(comCoresAtuais({ ...snapshot, corDosFiletes: "#5d4b91" }, { corDaMarca: "#8f5a4a", corDosFiletes: null }).corDosFiletes).toBeNull();
  });

  it("sem leitura das Configurações (falha), fica o snapshot inteiro", () => {
    expect(comCoresAtuais(snapshot, null)).toEqual(snapshot);
  });
});
