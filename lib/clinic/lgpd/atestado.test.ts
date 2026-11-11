import { describe, expect, it } from "vitest";
import {
  CATEGORIAS_RETIDAS,
  VERSAO_DO_ATESTADO,
  codigoCurto,
  codigoDoAtestado,
  dataHoraNoFuso,
  itensAnonimizados,
  linhaCanonica,
  linhasRetidas,
  normalizarCodigoCurto,
  textoDaDeclaracao,
  type DadosDoAtestado,
} from "./atestado";

function dados(sobrescrever: Partial<DadosDoAtestado> = {}): DadosDoAtestado {
  return {
    atestado_id: "11111111-2222-3333-4444-555555555555",
    organization_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    organization_name: "Clínica Fictícia Ltda",
    organization_document: "00.000.000/0001-00",
    executor: { user_id: "u1", nome: "Ana Executora", email: "ana@exemplo.test", papel: "admin" },
    ip: "203.0.113.10",
    anonimizado_em: "2026-11-11T15:00:00Z",
    emitido_em: "2026-11-11T15:01:00Z",
    retidos: { prontuario: 3, anexos: 2 },
    fuso: "America/Sao_Paulo",
    ...sobrescrever,
  };
}

describe("linhaCanonica", () => {
  it("tem exatamente 12 campos e nunca campo vazio", () => {
    const linha = linhaCanonica(dados());
    const campos = linha.split("|");
    expect(campos).toHaveLength(12);
    expect(campos[0]).toBe(VERSAO_DO_ATESTADO);
    expect(linha).not.toContain("||");
    expect(campos[11]).toBe("anexos=2,prontuario=3");
  });
  it("escreve '-' para campos ausentes", () => {
    const campos = linhaCanonica(
      dados({ organization_document: null, ip: null, retidos: {}, executor: { user_id: "u", nome: "N", email: null, papel: "admin" } }),
    ).split("|");
    expect(campos).toHaveLength(12);
    expect(campos[4]).toBe("-");
    expect(campos[6]).toBe("-");
    expect(campos[8]).toBe("-");
    expect(campos[11]).toBe("-");
  });
});

describe("codigoDoAtestado", () => {
  const chave = "uma-chave-bem-longa-123";
  it("é determinístico e muda com um caractere", () => {
    const a = codigoDoAtestado(dados(), chave);
    expect(codigoDoAtestado(dados(), chave)).toEqual(a);
    const b = codigoDoAtestado(dados({ organization_name: "Clínica Fictícia Ltdb" }), chave);
    expect(b.codigo).not.toBe(a.codigo);
  });
  it("escolhe o algoritmo pela chave", () => {
    expect(codigoDoAtestado(dados(), chave).algoritmo).toBe("hmac-sha256");
    for (const c of [null, "", "curta"]) {
      expect(codigoDoAtestado(dados(), c).algoritmo).toBe("sha256");
    }
  });
});

describe("código curto", () => {
  it("formata em 4 blocos", () => {
    expect(codigoCurto("abcdef0123456789ffff")).toBe("ABCD-EF01-2345-6789");
  });
  it("normaliza a entrada", () => {
    expect(normalizarCodigoCurto(" abcd ef01-2345 6789 ")).toBe("ABCD-EF01-2345-6789");
    expect(normalizarCodigoCurto("xyz")).toBeNull();
  });
});

describe("dataHoraNoFuso", () => {
  it("converte para o fuso", () => {
    expect(dataHoraNoFuso("2026-11-11T15:00:00Z", "America/Sao_Paulo")).toBe("11/11/2026 12:00:00 (America/Sao_Paulo)");
  });
  it("cai para UTC com fuso inválido", () => {
    expect(dataHoraNoFuso("2026-11-11T15:00:00Z", "Nao/Existe")).toMatch(/\(UTC\)$/);
  });
});

describe("itens e linhas retidas", () => {
  it("lista fixa de anonimizados", () => {
    expect(itensAnonimizados().length).toBeGreaterThanOrEqual(6);
  });
  it("só categorias com quantidade > 0", () => {
    expect(linhasRetidas({})).toEqual([]);
    const l = linhasRetidas({ prontuario: 2, anexos: 0 });
    expect(l).toHaveLength(1);
    expect(l[0]?.quantidade).toBe(2);
    expect(l[0]?.motivo).toBe(CATEGORIAS_RETIDAS.prontuario.motivo);
  });
});

describe("textoDaDeclaracao", () => {
  it("traz o protocolo e nenhum e-mail além do executor", () => {
    const t = textoDaDeclaracao(dados());
    expect(t).toContain("11111111-2222-3333-4444-555555555555");
    expect(t.match(/@/g)).toHaveLength(1);
    expect(t).toContain("ana@exemplo.test");
  });
  it("avisa de emissão tardia só com mais de 5 minutos", () => {
    expect(textoDaDeclaracao(dados())).not.toContain("emitido posteriormente");
    const t = textoDaDeclaracao(dados({ emitido_em: "2026-11-11T15:06:00Z" }));
    expect(t).toContain("emitido posteriormente");
  });
});
