/**
 * FORK clinic (9015) — o POP para impressão: monta os dados do renderizador de
 * documento (lib/documentos/renderizar.tsx) a partir do que o BANCO sabe.
 *
 * Código, versão, status, quem/quando criou, atualizou e aprovou saem daqui —
 * nunca do texto. Versão que não é a vigente leva a faixa (substituída ou
 * rascunho) no topo, no bloco da 1ª página e no rodapé de TODAS as páginas: uma
 * cópia antiga nunca passa por atual. "Impresso em" é a hora da impressão, e
 * aparece separada da aprovação.
 */
import type { DadosDoDocumento, MarcaDoDocumento } from "@/lib/documentos/renderizar";

import type { NoDoDocumento } from "./documento";

export type StatusDaVersao = "draft" | "approved" | "superseded" | "archived";

export interface EntradaDaImpressao {
  marca: MarcaDoDocumento;
  procedimento: string;
  codigo: string;
  versao: { major: number; minor: number; status: StatusDaVersao };
  criado: { por: string | null; em: string };
  atualizado: { por: string | null; em: string };
  aprovado: { por: string | null; em: string | null };
  impressoEm: Date;
  /** Fuso da clínica e tag de idioma para as datas. */
  fuso: string;
  tag: string;
  conteudo: NoDoDocumento;
}

const ROTULO_DO_STATUS: Record<StatusDaVersao, string> = {
  draft: "RASCUNHO",
  approved: "APROVADO",
  superseded: "SUBSTITUÍDO",
  archived: "ARQUIVADO",
};

function dataHora(iso: string | Date | null, fuso: string, tag: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(tag, { timeZone: fuso, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  }
}

export function faixaDaVersao(v: { major: number; minor: number; status: StatusDaVersao }): string | null {
  const n = `${v.major}.${v.minor}`;
  if (v.status === "superseded") return `VERSÃO ${n} — SUBSTITUÍDA — NÃO VIGENTE`;
  if (v.status === "draft") return `VERSÃO ${n} — RASCUNHO — NÃO APROVADO`;
  if (v.status === "archived") return `VERSÃO ${n} — ARQUIVADA — NÃO VIGENTE`;
  return null;
}

export function dadosDaImpressaoDoPop(e: EntradaDaImpressao): DadosDoDocumento {
  const n = `${e.versao.major}.${e.versao.minor}`;
  const quem = (x: string | null) => x ?? "—";
  const impresso = dataHora(e.impressoEm, e.fuso, e.tag);
  return {
    marca: e.marca,
    titulo: "PROCEDIMENTO OPERACIONAL PADRÃO — POP",
    subtitulo: `Procedimento: ${e.procedimento}`,
    identificacao: [
      ["Código", e.codigo],
      ["Versão", n],
      ["Status", ROTULO_DO_STATUS[e.versao.status]],
      ["Procedimento", e.procedimento],
    ],
    controle: [
      ["Criado por", `${quem(e.criado.por)} — ${dataHora(e.criado.em, e.fuso, e.tag)}`],
      ["Última atualização", `${quem(e.atualizado.por)} — ${dataHora(e.atualizado.em, e.fuso, e.tag)}`],
      ["Aprovado por", e.aprovado.em ? quem(e.aprovado.por) : "—"],
      ["Aprovado em", e.aprovado.em ? dataHora(e.aprovado.em, e.fuso, e.tag) : "—"],
    ],
    cabecalhoCompacto: [e.marca.nome, `POP — ${e.procedimento}`, `${e.codigo} | Versão ${n}`],
    rodape: (pagina, total) => `${e.codigo} | Versão ${n} | Página ${pagina} de ${total}  ·  Impresso em ${impresso}`,
    faixa: faixaDaVersao(e.versao),
    conteudo: e.conteudo,
  };
}
