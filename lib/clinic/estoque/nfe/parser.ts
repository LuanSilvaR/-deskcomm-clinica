/**
 * FORK clinic (estoque E5) — leitura do XML da NF-e (modelo 55).
 *
 * Puro e defensivo: o arquivo vem de fora (fornecedor). Antes de parsear,
 * recusa DOCTYPE/ENTITY (XXE, "billion laughs") e arquivo grande; o parser roda
 * sem processar entidades e sem converter valores (EAN "0789…" continua texto).
 * Devolve só o que o estoque usa: chave, emitente, destinatário, itens (com
 * lote/validade do `rastro` e registro ANVISA do `med`) e o custo de cada item
 * já com o rateio que a própria nota traz por item (frete, seguro, outras
 * despesas, IPI e ICMS-ST somam; desconto subtrai).
 */
import { XMLParser } from "fast-xml-parser";

export const TAMANHO_MAXIMO_NFE = 1024 * 1024;

export type MotivoNfeInvalida =
  | "grande_demais"
  | "dtd_proibido"
  | "nao_e_nfe"
  | "chave_invalida"
  | "sem_itens";

export class NfeInvalida extends Error {
  constructor(public readonly motivo: MotivoNfeInvalida) {
    super(`nfe_invalida:${motivo}`);
  }
}

export interface RastroDoItem {
  lote: string;
  quantidade: number | null;
  validade: string | null;
  fabricacao: string | null;
}

export interface ItemDaNfe {
  numero: number;
  codigo: string;
  descricao: string;
  ean: string | null;
  ncm: string | null;
  unidade: string;
  quantidade: number;
  valor_unitario_cents: number;
  valor_total_cents: number;
  /** Quanto o item custou de fato (com frete, seguro, outras, IPI, ST, − desconto). */
  custo_total_cents: number;
  registro_anvisa: string | null;
  rastro: RastroDoItem[];
}

export interface NfeLida {
  chave: string;
  numero: string;
  serie: string;
  emissao: string | null;
  emitente: { cnpj: string | null; nome: string };
  destinatario_cnpj: string | null;
  total_cents: number;
  itens: ItemDaNfe[];
}

type No = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  removeNSPrefix: true,
  isArray: (nome) => nome === "det" || nome === "rastro",
});

const obj = (v: unknown): No => (v && typeof v === "object" && !Array.isArray(v) ? (v as No) : {});
const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
/** Só as entidades padrão do XML e as numéricas (DOCTYPE já foi recusado). */
const decodificar = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] !== "#") return ENTIDADES[e.toLowerCase()] ?? "";
    const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
  });
const txt = (v: unknown): string =>
  typeof v === "string" ? decodificar(v.trim()) : typeof v === "number" ? String(v) : "";
const ouNulo = (v: unknown): string | null => txt(v) || null;
const num = (v: unknown): number => {
  const n = Number(txt(v));
  return Number.isFinite(n) ? n : 0;
};
const centavos = (v: unknown): number => Math.round(num(v) * 100);
const soDigitos = (v: unknown): string | null => {
  const d = txt(v).replace(/\D/g, "");
  return d || null;
};
/** EAN válido (8–14 dígitos); "SEM GTIN" e lixo viram nulo. */
const ean = (v: unknown): string | null => {
  const d = txt(v);
  return /^\d{8,14}$/.test(d) ? d : null;
};
const data = (v: unknown): string | null => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(txt(v));
  return m ? m[1]! : null;
};

/** Dígito verificador da chave de acesso (módulo 11, pesos 2..9 da direita). */
export function dvDaChave(chave43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function chaveValida(chave: string): boolean {
  return /^\d{44}$/.test(chave) && dvDaChave(chave.slice(0, 43)) === Number(chave[43]);
}

/** Soma o primeiro valor `campo` encontrado em qualquer filho de `no` (ICMS10, ICMS70…). */
function valorEmFilhos(no: No, campo: string): number {
  for (const filho of Object.values(no)) {
    const f = obj(filho);
    if (campo in f) return num(f[campo]);
  }
  return 0;
}

export function lerNfe(xml: string): NfeLida {
  if (Buffer.byteLength(xml, "utf8") > TAMANHO_MAXIMO_NFE) throw new NfeInvalida("grande_demais");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new NfeInvalida("dtd_proibido");

  let raiz: No;
  try {
    raiz = obj(parser.parse(xml));
  } catch {
    throw new NfeInvalida("nao_e_nfe");
  }
  const nfe = obj(obj(raiz.nfeProc).NFe ?? raiz.NFe);
  const inf = obj(nfe.infNFe);
  if (Object.keys(inf).length === 0) throw new NfeInvalida("nao_e_nfe");

  const chave = txt(inf["@_Id"]).replace(/^NFe/, "");
  if (!chaveValida(chave)) throw new NfeInvalida("chave_invalida");

  const ide = obj(inf.ide);
  const emit = obj(inf.emit);
  const dest = obj(inf.dest);
  const dets = Array.isArray(inf.det) ? (inf.det as unknown[]) : [];
  if (dets.length === 0) throw new NfeInvalida("sem_itens");

  const itens = dets.map((d, i): ItemDaNfe => {
    const det = obj(d);
    const prod = obj(det.prod);
    const imposto = obj(det.imposto);
    const ipi = num(obj(obj(imposto.IPI).IPITrib).vIPI);
    const st = valorEmFilhos(obj(imposto.ICMS), "vICMSST");
    const valorTotal = centavos(prod.vProd);
    const custo =
      valorTotal +
      centavos(prod.vFrete) +
      centavos(prod.vSeg) +
      centavos(prod.vOutro) +
      Math.round(ipi * 100) +
      Math.round(st * 100) -
      centavos(prod.vDesc);
    const rastros = Array.isArray(prod.rastro) ? (prod.rastro as unknown[]) : [];
    return {
      numero: Number(txt(det["@_nItem"])) || i + 1,
      codigo: txt(prod.cProd),
      descricao: txt(prod.xProd),
      ean: ean(prod.cEAN) ?? ean(prod.cEANTrib),
      ncm: soDigitos(prod.NCM),
      unidade: txt(prod.uCom) || "un",
      quantidade: num(prod.qCom),
      valor_unitario_cents: Math.round(num(prod.vUnCom) * 100 * 10000) / 10000,
      valor_total_cents: valorTotal,
      custo_total_cents: Math.max(0, custo),
      registro_anvisa: ouNulo(obj(prod.med).cProdANVISA),
      rastro: rastros.map((r) => {
        const x = obj(r);
        return {
          lote: txt(x.nLote),
          quantidade: txt(x.qLote) ? num(x.qLote) : null,
          validade: data(x.dVal),
          fabricacao: data(x.dFab),
        };
      }),
    };
  });

  return {
    chave,
    numero: txt(ide.nNF),
    serie: txt(ide.serie),
    emissao: data(ide.dhEmi ?? ide.dEmi),
    emitente: { cnpj: soDigitos(emit.CNPJ), nome: txt(emit.xNome) },
    destinatario_cnpj: soDigitos(dest.CNPJ),
    total_cents: centavos(obj(obj(inf.total).ICMSTot).vNF),
    itens,
  };
}
