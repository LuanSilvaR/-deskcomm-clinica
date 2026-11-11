import { createHash, createHmac } from "node:crypto";

import { tagDeIdioma } from "@/lib/i18n/datas";
import { IDIOMA_PADRAO } from "@/lib/i18n/idiomas";

// Núcleo puro do atestado de anonimização (LGPD). Sem I/O: só texto, código e datas.

export const VERSAO_DO_ATESTADO = "clinic-atestado-anonimizacao.v1";

export type CategoriaRetida = "prontuario" | "anexos" | "documentos" | "planos" | "financeiro";

export const CATEGORIAS_RETIDAS: Record<
  CategoriaRetida,
  { tabelas: string[]; rotulo: string; motivo: string }
> = {
  prontuario: {
    tabelas: ["clinic_prontuarios", "clinic_atendimentos"],
    rotulo: "Prontuário e atendimentos",
    motivo:
      "guarda mínima de 20 anos a partir do último registro (Lei 13.787/2018, art. 6º, e normas do conselho profissional do responsável técnico); cumprimento de obrigação legal (LGPD art. 16, I, e art. 11, II, \"a\")",
  },
  anexos: {
    tabelas: ["clinic_anexos"],
    rotulo: "Fotos e anexos clínicos",
    motivo: "integram o prontuário: mesma guarda legal (Lei 13.787/2018, art. 6º; LGPD art. 16, I)",
  },
  documentos: {
    tabelas: ["clinic_documentos_emitidos"],
    rotulo: "Documentos emitidos e termos",
    motivo: "prova do consentimento e da prestação do serviço, para exercício regular de direitos (LGPD art. 7º, VI, e art. 11, II, \"d\"), durante o prazo prescricional (CDC art. 27)",
  },
  planos: {
    tabelas: ["clinic_planos_tratamento"],
    rotulo: "Planos de tratamento",
    motivo: "integram o prontuário: mesma guarda legal (Lei 13.787/2018, art. 6º; LGPD art. 16, I)",
  },
  financeiro: {
    tabelas: ["sales", "clinic_orcamentos"],
    rotulo: "Registros financeiros",
    motivo:
      "registros fiscais e contábeis (CTN art. 173 e 174; prazo de 5 anos); cumprimento de obrigação legal (LGPD art. 16, I)",
  },
};

/** Só categorias com quantidade maior que zero. */
export type Retidos = Partial<Record<CategoriaRetida, number>>;

export interface ExecutorDoAtestado {
  user_id: string;
  nome: string;
  email: string | null;
  papel: string;
}

export interface DadosDoAtestado {
  atestado_id: string;
  organization_id: string;
  organization_name: string;
  organization_document: string | null;
  executor: ExecutorDoAtestado;
  ip: string | null;
  anonimizado_em: string;
  emitido_em: string;
  retidos: Retidos;
  fuso: string;
}

function campo(valor: string | null | undefined): string {
  const v = (valor ?? "").replace(/\|/g, "/").trim();
  return v === "" ? "-" : v;
}

export function linhaCanonica(d: DadosDoAtestado): string {
  const retidos =
    Object.entries(d.retidos)
      .filter(([, n]) => typeof n === "number" && n > 0)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, n]) => `${k}=${n}`)
      .join(",") || "-";
  return [
    VERSAO_DO_ATESTADO,
    campo(d.atestado_id),
    campo(d.organization_id),
    campo(d.organization_name),
    campo(d.organization_document),
    campo(d.executor.nome),
    campo(d.executor.email),
    campo(d.executor.papel),
    campo(d.ip),
    campo(d.anonimizado_em),
    campo(d.emitido_em),
    retidos,
  ].join("|");
}

export function codigoDoAtestado(
  d: DadosDoAtestado,
  chave: string | null | undefined,
): { codigo: string; algoritmo: "hmac-sha256" | "sha256" } {
  const linha = linhaCanonica(d);
  if (chave && chave.length > 10) {
    return { codigo: createHmac("sha256", chave).update(linha).digest("hex"), algoritmo: "hmac-sha256" };
  }
  return { codigo: createHash("sha256").update(linha).digest("hex"), algoritmo: "sha256" };
}

/** 16 primeiros hex em 4 blocos maiúsculos: ABCD-EF01-2345-6789. */
export function codigoCurto(codigo: string): string {
  const hex = codigo.slice(0, 16).toUpperCase();
  return [0, 4, 8, 12].map((i) => hex.slice(i, i + 4)).join("-");
}

export function normalizarCodigoCurto(entrada: string): string | null {
  const limpo = entrada.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[0-9A-F]{16}$/.test(limpo)) return null;
  return codigoCurto(limpo);
}

export function dataHoraNoFuso(iso: string, fuso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  const formatar = (tz: string) => {
    const partes = new Intl.DateTimeFormat(tagDeIdioma(IDIOMA_PADRAO), {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(data);
    const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
    return `${p("day")}/${p("month")}/${p("year")} ${p("hour")}:${p("minute")}:${p("second")} (${tz})`;
  };
  try {
    return formatar(fuso);
  } catch {
    return formatar("UTC");
  }
}

export function itensAnonimizados(): string[] {
  return [
    "dados de contato (nome, telefones, e-mail, documento)",
    "a ficha do paciente",
    "as conversas, as mensagens e o resumo da IA",
    "a agenda (títulos e notas)",
    "os orçamentos (observações e motivos)",
    "as tarefas, as propostas e as campanhas",
    "demais registros vinculados ao contato fora do prontuário (casos, ligações, transcrições, prospecção, campos personalizados e captações)",
  ];
}

export function linhasRetidas(r: Retidos): { rotulo: string; quantidade: number; motivo: string }[] {
  const ordem = Object.keys(CATEGORIAS_RETIDAS) as CategoriaRetida[];
  return ordem
    .filter((c) => (r[c] ?? 0) > 0)
    .map((c) => ({
      rotulo: CATEGORIAS_RETIDAS[c].rotulo,
      quantidade: r[c] as number,
      motivo: CATEGORIAS_RETIDAS[c].motivo,
    }));
}

const CINCO_MINUTOS_MS = 5 * 60 * 1000;

export function textoDaDeclaracao(d: DadosDoAtestado): string {
  const quando = dataHoraNoFuso(d.anonimizado_em, d.fuso);
  const emissao = dataHoraNoFuso(d.emitido_em, d.fuso);
  const executor = `${d.executor.nome}, na função de ${d.executor.papel}`;
  const controlador = d.organization_document
    ? `${d.organization_name} (CNPJ ${d.organization_document})`
    : d.organization_name;
  const partes = [
    `Declaramos, na qualidade de controlador (${controlador}), que os dados de identificação e de contato do titular identificado pelo protocolo ${d.atestado_id} foram anonimizados, em atendimento à solicitação do titular (LGPD art. 18, IV e VI), e os demais dados não sujeitos a guarda legal foram redigidos, em ${quando}, por ${executor}.`,
  ];
  const diferenca = Math.abs(new Date(d.emitido_em).getTime() - new Date(d.anonimizado_em).getTime());
  if (diferenca > CINCO_MINUTOS_MS) {
    partes.push(
      `Este atestado foi emitido posteriormente ao ato: anonimização em ${quando}; emissão em ${emissao}.`,
    );
  }
  partes.push(
    "Os registros retidos permanecem sob guarda da clínica, com acesso restrito, apenas pelo prazo e para as finalidades legais indicadas, e podem conter dados clínicos do titular.",
  );
  return partes.join(" ");
}
