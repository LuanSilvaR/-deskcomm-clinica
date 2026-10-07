import { describe, expect, it } from "vitest";

import { DOCUMENTO_VAZIO, textoPuro, validarDocumento } from "@/lib/clinic/pops/documento";
import { MODELO_PADRAO, TITULOS_DO_MODELO, modeloPadrao } from "@/lib/clinic/pops/modelo";

const doc = (content: unknown[]) => ({ type: "doc", content });

describe("documento do POP", () => {
  it("o modelo padrão e o documento vazio são válidos", () => {
    expect(validarDocumento(MODELO_PADRAO).ok).toBe(true);
    expect(validarDocumento(DOCUMENTO_VAZIO).ok).toBe(true);
    expect(TITULOS_DO_MODELO).toHaveLength(21);
    expect(TITULOS_DO_MODELO[20]).toBe("21. CONTROLE DE REVISÕES");
  });

  it("aceita títulos, listas, tabela, negrito/itálico/sublinhado e quebra de página", () => {
    const r = validarDocumento(
      doc([
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Título", marks: [{ type: "bold" }] }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item" }] }] }] },
        { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
        {
          type: "table",
          content: [{ type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph" }] }] }],
        },
        { type: "quebraDePagina" },
        { type: "paragraph", content: [{ type: "text", text: "fim", marks: [{ type: "italic" }, { type: "underline" }] }] },
      ]),
    );
    expect(r.ok).toBe(true);
  });

  it("recusa link, imagem, HTML cru e atributos livres", () => {
    expect(validarDocumento(doc([{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }])).ok).toBe(false);
    expect(validarDocumento(doc([{ type: "image", attrs: { src: "http://x" } }])).ok).toBe(false);
    expect(validarDocumento(doc([{ type: "paragraph", attrs: { style: "color:red" } }])).ok).toBe(false);
    expect(validarDocumento({ type: "doc", content: [], html: "<script>" }).ok).toBe(false);
    expect(validarDocumento(doc([{ type: "heading", attrs: { level: 6 }, content: [] }])).ok).toBe(false);
  });

  it("<script> digitado é só TEXTO (não vira HTML em lugar nenhum)", () => {
    const r = validarDocumento(doc([{ type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>" }] }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(textoPuro(r.documento)).toBe("<script>alert(1)</script>");
  });

  it("recusa documento acima de 1 MB e profundo demais", () => {
    expect(validarDocumento(doc([{ type: "paragraph", content: [{ type: "text", text: "a".repeat(20_000) }] }].concat(Array(60).fill({ type: "paragraph", content: [{ type: "text", text: "b".repeat(20_000) }] })))).ok).toBe(false);
    let fundo: Record<string, unknown> = { type: "paragraph" };
    for (let i = 0; i < 20; i++) fundo = { type: "bulletList", content: [{ type: "listItem", content: [fundo] }] };
    expect(validarDocumento(doc([fundo])).ok).toBe(false);
  });

  it("texto puro: títulos e parágrafos em linhas, células separadas", () => {
    expect(textoPuro(MODELO_PADRAO).split("\n")[0]).toBe("1. IDENTIFICAÇÃO");
  });
});

describe("modelo no idioma de quem cria", () => {
  it("espanhol: 21 seções válidas, títulos em espanhol", () => {
    const es = modeloPadrao("es");
    expect(validarDocumento(es).ok).toBe(true);
    const titulos = textoPuro(es).split("\n").filter((l) => /^\d+\. /.test(l));
    expect(titulos).toHaveLength(21);
    expect(titulos[0]).toBe("1. IDENTIFICACIÓN");
    expect(titulos[20]).toBe("21. CONTROL DE REVISIONES");
  });
  it("português é o padrão (e o de quem não tem idioma)", () => {
    expect(modeloPadrao("pt-BR")).toBe(MODELO_PADRAO);
    expect(modeloPadrao(undefined)).toBe(MODELO_PADRAO);
  });
});
