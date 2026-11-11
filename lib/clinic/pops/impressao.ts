/**
 * FORK clinic (9015) — o POP para impressão: monta o DOCUMENTO TIMBRADO
 * (lib/documentos/renderizar.tsx) a partir do que o BANCO sabe.
 *
 * Só conteúdo: tipo, número, título, metadados, avisos e corpo. Marca, cores,
 * fontes, cabeçalho e rodapé são do motor de documentos (papel timbrado único).
 *
 * Código, versão, status, quem/quando criou, atualizou e aprovou saem daqui —
 * nunca do texto. Versão que não é a vigente leva o aviso no bloco de abertura
 * e numa linha acima do rodapé de TODAS as páginas: uma cópia antiga nunca
 * passa por atual. "Impresso em" é a hora da impressão, separada da aprovação.
 */
import type { DocumentoTimbrado } from "@/lib/documentos/renderizar";

import type { NoDoDocumento } from "./documento";

export type StatusDaVersao = "draft" | "approved" | "superseded" | "archived";

export interface EntradaDaImpressao {
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
  draft: "Rascunho",
  approved: "Aprovado",
  superseded: "Substituído",
  archived: "Arquivado",
};

function dataHora(iso: string | Date | null, fuso: string, tag: string): string | null {
  if (!iso) return null;
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

/** "Nome — 07/11/2026 14:30", sem o nome quando ele não existe. */
function quemEQuando(por: string | null, em: string | null, fuso: string, tag: string): string | null {
  const quando = dataHora(em, fuso, tag);
  if (!quando) return null;
  return por ? `${por} — ${quando}` : quando;
}

export function dadosDaImpressaoDoPop(e: EntradaDaImpressao): DocumentoTimbrado {
  const n = `${e.versao.major}.${e.versao.minor}`;
  const faixa = faixaDaVersao(e.versao);
  return {
    tipo: "Procedimento Operacional Padrão",
    numero: `${e.codigo} · v${n}`,
    titulo: e.procedimento,
    metadados: [
      ["Código", e.codigo],
      ["Versão", `${n} · ${ROTULO_DO_STATUS[e.versao.status]}`],
      ["Criado por", quemEQuando(e.criado.por, e.criado.em, e.fuso, e.tag)],
      ["Última atualização", quemEQuando(e.atualizado.por, e.atualizado.em, e.fuso, e.tag)],
      ["Aprovado por", e.aprovado.em ? quemEQuando(e.aprovado.por, e.aprovado.em, e.fuso, e.tag) : null],
      ["Impresso em", dataHora(e.impressoEm, e.fuso, e.tag)],
    ],
    avisos: faixa ? [{ estado: e.versao.status === "draft" ? "atencao" : "perigo", texto: faixa, emTodasAsPaginas: true }] : [],
    corpo: e.conteudo,
    emitidoEm: e.impressoEm,
  };
}
