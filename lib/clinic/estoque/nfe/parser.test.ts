import { describe, expect, it } from "vitest";

import { chaveValida, dvDaChave, lerNfe, NfeInvalida } from "./parser";

// Chave fictícia com dígito verificador correto (dados inventados).
const BASE = "3526100000000000019155001000001234100000001";
export const CHAVE_FICTICIA = BASE + String(dvDaChave(BASE));

export function nfeFicticia(opcoes: { chave?: string; extra?: string } = {}): string {
  const chave = opcoes.chave ?? CHAVE_FICTICIA;
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${chave}" versao="4.00">
      <ide><serie>1</serie><nNF>1234</nNF><dhEmi>2026-09-30T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>00.000.000/0001-91</CNPJ><xNome>Distribuidora Fictícia &amp; Cia</xNome></emit>
      <dest><CNPJ>11111111000111</CNPJ><xNome>Clínica Fictícia</xNome></dest>
      <det nItem="1">
        <prod>
          <cProd>TOX-100</cProd><cEAN>07891234567895</cEAN><xProd>TOXINA FICTICIA 100U</xProd>
          <NCM>30049099</NCM><uCom>FR</uCom><qCom>2.0000</qCom><vUnCom>1000.0000000000</vUnCom>
          <vProd>2000.00</vProd><cEANTrib>07891234567895</cEANTrib><vFrete>20.00</vFrete><vDesc>100.00</vDesc>
          <rastro><nLote>L-ABC</nLote><qLote>2.000</qLote><dFab>2026-01-01</dFab><dVal>2028-01-31</dVal></rastro>
          <med><cProdANVISA>1234567890123</cProdANVISA><vPMC>0.00</vPMC></med>
        </prod>
        <imposto><IPI><IPITrib><vIPI>10.00</vIPI></IPITrib></IPI>
          <ICMS><ICMS10><vICMSST>5.50</vICMSST></ICMS10></ICMS></imposto>
      </det>
      <det nItem="2">
        <prod>
          <cProd>GZ-1</cProd><cEAN>SEM GTIN</cEAN><xProd>GAZE FICTICIA</xProd><NCM>3005.90.90</NCM>
          <uCom>PCT</uCom><qCom>10</qCom><vUnCom>3.5</vUnCom><vProd>35.00</vProd>
        </prod>
      </det>
      <total><ICMSTot><vNF>1970.50</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
  ${opcoes.extra ?? ""}
</nfeProc>`;
}

describe("chave de acesso", () => {
  it("dígito verificador por módulo 11", () => {
    expect(chaveValida(CHAVE_FICTICIA)).toBe(true);
    const errada = CHAVE_FICTICIA.slice(0, 43) + String((Number(CHAVE_FICTICIA[43]) + 1) % 10);
    expect(chaveValida(errada)).toBe(false);
    expect(chaveValida("123")).toBe(false);
  });
});

describe("lerNfe", () => {
  const nfe = lerNfe(nfeFicticia());

  it("cabeçalho: chave, número, série, emissão, emitente e destinatário só com dígitos", () => {
    expect(nfe.chave).toBe(CHAVE_FICTICIA);
    expect([nfe.numero, nfe.serie, nfe.emissao]).toEqual(["1234", "1", "2026-09-30"]);
    expect(nfe.emitente).toEqual({ cnpj: "00000000000191", nome: "Distribuidora Fictícia & Cia" });
    expect(nfe.destinatario_cnpj).toBe("11111111000111");
    expect(nfe.total_cents).toBe(197050);
  });

  it("item com rastro, ANVISA e custo rateado (vProd + frete + IPI + ST − desconto)", () => {
    const [tox] = nfe.itens;
    expect(tox).toMatchObject({
      numero: 1,
      codigo: "TOX-100",
      ean: "07891234567895",
      ncm: "30049099",
      unidade: "FR",
      quantidade: 2,
      valor_total_cents: 200000,
      custo_total_cents: 200000 + 2000 + 1000 + 550 - 10000,
      registro_anvisa: "1234567890123",
    });
    expect(tox?.rastro).toEqual([{ lote: "L-ABC", quantidade: 2, validade: "2028-01-31", fabricacao: "2026-01-01" }]);
  });

  it("'SEM GTIN' vira EAN nulo; NCM só dígitos; sem rastro", () => {
    const gaze = nfe.itens[1];
    expect(gaze).toMatchObject({ ean: null, ncm: "30059090", quantidade: 10, custo_total_cents: 3500, rastro: [] });
  });

  it("recusa DOCTYPE/ENTITY (XXE), arquivo grande, chave inválida e o que não é NF-e", () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>${nfeFicticia()}`;
    expect(() => lerNfe(xxe)).toThrow(NfeInvalida);
    expect(() => lerNfe(xxe)).toThrow("dtd_proibido");
    expect(() => lerNfe(nfeFicticia({ extra: "x".repeat(1024 * 1024) }))).toThrow("grande_demais");
    expect(() => lerNfe(nfeFicticia({ chave: "1".repeat(44) }))).toThrow("chave_invalida");
    expect(() => lerNfe("<html><body>oi</body></html>")).toThrow("nao_e_nfe");
    expect(() => lerNfe("não é xml <<<")).toThrow(NfeInvalida);
  });
});
