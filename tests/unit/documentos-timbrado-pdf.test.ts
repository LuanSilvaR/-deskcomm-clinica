// @vitest-environment node
/**
 * FORK clinic — o papel timbrado de ponta a ponta: contexto da marca (símbolo,
 * logo opaco, campos vazios) e o PDF (A4, fontes embutidas, metadados,
 * determinismo, nada de "[placeholder]"). Imagens geradas aqui; dados fictícios.
 */
import { inflateSync } from "node:zlib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { extractPdfText } from "@/lib/ai/rag/extractors/pdf";
import { montarContextoDaMarca } from "@/lib/documentos/contexto-da-marca";
import { renderizarDocumento, type DocumentoTimbrado } from "@/lib/documentos/renderizar";

const png = (largura: number, altura: number, transparente: boolean) =>
  sharp({
    create: { width: largura, height: altura, channels: 4, background: { r: 143, g: 90, b: 74, alpha: transparente ? 0 : 1 } },
  })
    .composite([
      {
        input: { create: { width: Math.round(largura / 2), height: Math.round(altura / 2), channels: 4, background: { r: 143, g: 90, b: 74, alpha: 1 } } },
        gravity: "center",
      },
    ])
    .png()
    .toBuffer();

const DOC: DocumentoTimbrado = {
  tipo: "Declaração",
  numero: "001/2026",
  titulo: "Declaração de teste",
  metadados: [
    ["Data", "07/11/2026"],
    ["Destinatário(a)", "Paciente Ficticia"],
    ["Assunto", ""],
  ],
  corpo: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Ação, coração e informação." }] }] },
  assinatura: { nome: "Profissional Ficticia", cargo: "Biomédica · CRBM 0000" },
  emitidoEm: new Date("2026-11-07T12:00:00Z"),
};

async function texto(buf: Buffer) {
  return (await extractPdfText(buf, { estrategia: "em-processo" })).replace(/\s+/g, " ");
}

describe("contexto da marca", () => {
  it("logo compacto e transparente vira o símbolo; marca d'água só com 600 px ou mais", async () => {
    const grande = await montarContextoDaMarca({ nomeDaMarca: "Marca", logo: await png(800, 800, true) });
    expect(grande.simbolo).not.toBeNull();
    expect(grande.marcaDagua).not.toBeNull();
    const pequeno = await montarContextoDaMarca({ nomeDaMarca: "Marca", logo: await png(300, 300, true) });
    expect(pequeno.simbolo).not.toBeNull();
    expect(pequeno.marcaDagua).toBeNull();
  });

  it("logo transparente tem as margens recortadas", async () => {
    const c = await montarContextoDaMarca({ nomeDaMarca: "Marca", logo: await png(800, 800, true) });
    expect(c.logo?.largura).toBe(400);
  });

  it("logo horizontal (traz o nome) não é símbolo: usa o favicon", async () => {
    const c = await montarContextoDaMarca({ nomeDaMarca: "Marca", logo: await png(1200, 300, true), favicon: await png(512, 512, true) });
    expect(c.logo).not.toBeNull();
    expect(c.simbolo?.largura).toBe(512);
    expect(c.marcaDagua).not.toBeNull();
  });

  it("logo com fundo opaco: fica de fora e avisa", async () => {
    const c = await montarContextoDaMarca({ nomeDaMarca: "Marca", logo: await png(800, 800, false) });
    expect(c.logo).toBeNull();
    expect(c.simbolo).toBeNull();
    expect(c.avisos.join(" ")).toMatch(/fundo opaco/);
  });

  it("CNPJ inválido é omitido e avisado; razão social cai no nome da marca", async () => {
    const c = await montarContextoDaMarca({ nomeDaMarca: "Marca Ficticia", cnpj: "11.111.111/1111-11" });
    expect(c.cnpj).toBeNull();
    expect(c.avisos.join(" ")).toMatch(/CNPJ/);
    expect(c.razaoSocial).toBe("Marca Ficticia");
  });
});

describe("PDF do papel timbrado", () => {
  it("A4, fontes embutidas, metadados com a organização e o texto com acentos", async () => {
    const ctx = await montarContextoDaMarca({ nomeDaMarca: "Marca Ficticia", razaoSocial: "Marca Ficticia LTDA", corDaMarca: "#8F5A4A" });
    const buf = await renderizarDocumento(DOC, ctx);
    const cru = buf.toString("latin1");
    expect(cru).toMatch(/\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/);
    expect(cru).toMatch(/\/FontFile2|\/FontFile3|\/FontFile /);
    expect(cru).toMatch(/Inter/);
    expect(cru).toMatch(/Cormorant/);
    expect(cru).not.toMatch(/\/BaseFont \/Helvetica/);
    const t = await texto(buf);
    expect(t).toContain("Ação, coração e informação.");
    expect(t).toContain("Marca Ficticia LTDA");
    expect(t).toContain("Página 1 de 1");
    expect(t).toContain("Atenciosamente,");
    expect(t).not.toContain("[");
  }, 60_000);

  it("campo vazio não aparece: metadado sem valor, CNPJ, endereço e contatos ausentes não deixam rótulo", async () => {
    const ctx = await montarContextoDaMarca({ nomeDaMarca: "Marca Ficticia" });
    const t = (await texto(await renderizarDocumento(DOC, ctx))).replace(/\s+/g, "");
    expect(t).not.toContain("ASSUNTO");
    expect(t).not.toContain("CNPJ");
        expect(t).not.toContain("WhatsApp");
  }, 60_000);

  it("#126: a cor do papel timbrado pinta o PDF (faixa, títulos, tabela) — a cor da Marca sai de cena", async () => {
    const ctx = await montarContextoDaMarca({ nomeDaMarca: "Marca Ficticia", corDaMarca: "#8F5A4A", corDosFiletes: "#5d4b91" });
    const desenho = coresDoPdf(await renderizarDocumento(DOC, ctx));
    expect(desenho).toContain(rgb("#5d4b91"));
    expect(desenho).not.toContain(rgb("#8f5a4a"));
  }, 60_000);

  it("#126: o rótulo de versão/estado (caixa de aviso) segue a paleta do papel, não o amarelo fixo", async () => {
    const ctx = await montarContextoDaMarca({ nomeDaMarca: "Marca Ficticia", corDosFiletes: "#5d4b91" });
    const comAviso: DocumentoTimbrado = {
      ...DOC,
      avisos: [
        { estado: "atencao", texto: "VERSÃO 3.0 — RASCUNHO — NÃO APROVADO" },
        { estado: "atencao", texto: "RASCUNHO", emTodasAsPaginas: true, soNaLinhaFixa: true },
      ],
    };
    const desenho = coresDoPdf(await renderizarDocumento(comAviso, ctx));
    expect(await texto(await renderizarDocumento(comAviso, ctx))).toContain("RASCUNHO — NÃO APROVADO");
    for (const amarelo of ["#fdf5e6", "#e2b866", "#5c3d00"]) expect(desenho).not.toContain(rgb(amarelo));
    expect(desenho).toContain(rgb(ctx.cores.surface));
  }, 60_000);

  it("determinístico: mesmo documento e mesmo contexto geram o mesmo arquivo", async () => {
    const ctx = await montarContextoDaMarca({ nomeDaMarca: "Marca Ficticia", corDaMarca: "#8F5A4A" });
    const a = await renderizarDocumento(DOC, ctx);
    const b = await renderizarDocumento(DOC, ctx);
    expect(a.equals(b)).toBe(true);
  }, 60_000);
});

/** Operadores de cor (`r g b scn` / `SCN` / `rg`) de todos os streams do PDF, já descomprimidos. */
function coresDoPdf(buf: Buffer): string[] {
  const cru = buf.toString("latin1");
  const cores: string[] = [];
  for (const m of cru.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let corpo: string;
    try {
      corpo = inflateSync(Buffer.from(m[1] ?? "", "latin1")).toString("latin1");
    } catch {
      corpo = m[1] ?? "";
    }
    for (const c of corpo.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (?:rg|RG|scn|SCN)\b/g)) {
      cores.push([c[1], c[2], c[3]].map((n) => Math.round(Number(n) * 255).toString(16).padStart(2, "0")).join(""));
    }
  }
  return cores;
}

function rgb(hex: string): string {
  return hex.slice(1).toLowerCase();
}
