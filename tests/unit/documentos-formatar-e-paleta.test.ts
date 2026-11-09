/**
 * FORK clinic — papel timbrado: formatação dos dados da empresa (campo vazio
 * nunca aparece) e os 7 papéis de cor com contraste WCAG garantido.
 * Dados fictícios.
 */
import { describe, expect, it } from "vitest";

import { razaoDeContraste } from "@/lib/branding/contraste";
import { hexParaOklch } from "@/lib/branding/rampa";
import {
  cidadeUf,
  cidadeUfCep,
  cnpjValido,
  formatarCnpj,
  formatarSite,
  linhaDoEndereco,
  linhaDoResponsavel,
  linhasDeContato,
} from "@/lib/documentos/formatar";
import { PAPEIS_PADRAO, paraPretoEBranco, PISO_DE_TEXTO, resolverPaleta } from "@/lib/documentos/paleta";

describe("formatação", () => {
  it("CNPJ: máscara só com dígitos verificadores válidos", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCnpj("11.222.333/0001-82")).toBeNull();
    expect(formatarCnpj("00000000000000")).toBeNull();
    expect(formatarCnpj("")).toBeNull();
    expect(formatarCnpj(null)).toBeNull();
  });

  it("site: exibe sem protocolo nem www, mantém o link completo", () => {
    expect(formatarSite("https://www.clinica-ficticia.com.br/")).toEqual({
      exibir: "clinica-ficticia.com.br",
      url: "https://www.clinica-ficticia.com.br/",
    });
    expect(formatarSite("clinica-ficticia.com.br")).toEqual({ exibir: "clinica-ficticia.com.br", url: "https://clinica-ficticia.com.br" });
    expect(formatarSite("  ")).toBeNull();
  });

  it("telefone e WhatsApp: iguais viram uma linha com os dois rótulos; diferentes, duas", () => {
    expect(linhasDeContato("61999998888", "(61) 99999-8888")).toEqual(["Telefone / WhatsApp (61) 99999-8888"]);
    expect(linhasDeContato("6133334444", "61999998888")).toEqual(["(61) 3333-4444", "WhatsApp (61) 99999-8888"]);
    expect(linhasDeContato(null, "")).toEqual([]);
  });

  it("endereço: só as partes que existem, sem separador sobrando", () => {
    expect(linhaDoEndereco({ logradouro: "Rua A", numero: "10", complemento: "", bairro: "Centro" })).toBe("Rua A, 10, Centro");
    expect(linhaDoEndereco({})).toBeNull();
    expect(cidadeUf({ cidade: "Planaltina", uf: "go" })).toBe("Planaltina – GO");
    expect(cidadeUfCep({ cidade: "Planaltina", uf: "GO", cep: "73750000" })).toBe("Planaltina – GO · 73750-000");
    expect(cidadeUfCep({ cep: "73750000" })).toBe("73750-000");
    expect(cidadeUfCep({})).toBeNull();
  });

  it("responsável técnico: sem nome não há linha; sem registro, só o nome", () => {
    expect(linhaDoResponsavel(null, "CRM 1")).toBeNull();
    expect(linhaDoResponsavel("Pessoa Ficticia", null)).toBe("Responsável técnica: Pessoa Ficticia");
    expect(linhaDoResponsavel("Pessoa Ficticia", "CRBM 0000")).toBe("Responsável técnica: Pessoa Ficticia · CRBM 0000");
  });
});

const BRANCO = "#FFFFFF";
const contrastesOk = (p: ReturnType<typeof resolverPaleta>["papeis"]) => {
  for (const papel of ["ink", "muted"] as const) {
    expect(razaoDeContraste(p[papel], p.paper), `${papel} sobre paper`).toBeGreaterThanOrEqual(PISO_DE_TEXTO);
    expect(razaoDeContraste(p[papel], p.surface), `${papel} sobre surface`).toBeGreaterThanOrEqual(PISO_DE_TEXTO);
  }
  expect(razaoDeContraste(p.primary, p.paper), "primary sobre paper").toBeGreaterThanOrEqual(PISO_DE_TEXTO);
  expect(razaoDeContraste(p.ink, BRANCO)).toBeGreaterThanOrEqual(12);
};

describe("paleta: 7 papéis com contraste WCAG", () => {
  it("sem cor da marca: os padrões do Design System", () => {
    expect(resolverPaleta({}).papeis).toEqual(PAPEIS_PADRAO);
  });

  it("a cor da marca vira o primary sem mudar, quando já tem contraste", () => {
    const r = resolverPaleta({ semente: "#8F5A4A", corDosFiletes: "#D4AF7C" });
    expect(r.papeis.primary).toBe("#8f5a4a");
    expect(r.papeis.accent).toBe("#d4af7c");
    expect(r.avisos).toEqual([]);
    contrastesOk(r.papeis);
  });

  it.each(["#ffd400", "#a0e7ff", "#f0f0f0", "#0b1d3a", "#ff00ff", "#7a5cd6"])("cor %s: todos os papéis de texto passam de 4,5:1", (cor) => {
    contrastesOk(resolverPaleta({ semente: cor }).papeis);
  });

  it("cor clara demais: escurece só a luminosidade (o matiz fica) e avisa", () => {
    const r = resolverPaleta({ semente: "#ffd400" });
    expect(r.avisos.join(" ")).toMatch(/escurecida/);
    const h = (x: string) => hexParaOklch(x).h;
    expect(Math.abs(h(r.papeis.primary) - h("#ffd400"))).toBeLessThan(6);
  });

  it("sem cor dos filetes, o accent sai da rampa da marca; cor inválida é ignorada", () => {
    expect(resolverPaleta({ semente: "#8F5A4A" }).papeis.accent).not.toBe(PAPEIS_PADRAO.accent);
    expect(resolverPaleta({ semente: "#8F5A4A", corDosFiletes: "dourado" }).papeis.accent).not.toBe("dourado");
  });

  it("preto e branco: primary vira o ink", () => {
    const p = resolverPaleta({ semente: "#8F5A4A" }).papeis;
    expect(paraPretoEBranco(p).primary).toBe(p.ink);
  });
});
