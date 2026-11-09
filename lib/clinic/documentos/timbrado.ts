/**
 * FORK clinic (papel timbrado D3) — o documento EMITIDO (termo, consentimento,
 * contrato…) como `DocumentoTimbrado`. Pura: recebe o que o banco guardou e
 * devolve só conteúdo. Marca, cores e estilo são do motor (lib/documentos).
 *
 * O texto é o CONGELADO na emissão (o que o paciente leu e aceitou), nunca
 * remontado. O registro do aceite, a situação e a integridade (sha256) entram
 * como metadados; documento revogado ou cancelado leva o aviso em todas as
 * páginas.
 */
import type { NoDoDocumento } from "@/lib/clinic/pops/documento";
import type { AvisoDoDocumento, DocumentoTimbrado } from "@/lib/documentos/renderizar";

export type TipoDeDocumento = "contrato" | "consentimento" | "autorizacao" | "uso_imagem" | "ciencia";

const ROTULO_DO_TIPO: Record<TipoDeDocumento, string> = {
  contrato: "Contrato",
  consentimento: "Termo de consentimento",
  autorizacao: "Autorização",
  uso_imagem: "Autorização de uso de imagem",
  ciencia: "Termo de ciência",
};

const ROTULO_DA_SITUACAO: Record<string, string> = {
  emitido: "Aguardando aceite",
  aceito: "Aceito",
  revogado: "Revogado",
  cancelado: "Cancelado",
};

export interface DocumentoEmitido {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string;
  sha256: string;
  status: string;
  criadoEm: string;
  validadeAte: string | null;
  paciente: string | null;
  aceite: { nome: string | null; canal: string; em: string } | null;
  revogacao: { em: string; motivo: string | null } | null;
  /** Número do documento quando há um (ex.: o do orçamento "007/2026"). */
  numero?: string | null;
}

/** Texto congelado → blocos: "# " e "## " viram títulos, "- " vira lista, o resto parágrafo. */
export function textoParaBlocos(texto: string): NoDoDocumento {
  const blocos: NoDoDocumento[] = [];
  let lista: NoDoDocumento | null = null;
  const paragrafo = (t: string): NoDoDocumento => ({ type: "paragraph", content: [{ type: "text", text: t }] });
  for (const crua of texto.replace(/\r\n/g, "\n").split("\n")) {
    const linha = crua.trimEnd();
    if (/^\s*[-•]\s+/.test(linha)) {
      if (!lista) {
        lista = { type: "bulletList", content: [] };
        blocos.push(lista);
      }
      lista.content!.push({ type: "listItem", content: [paragrafo(linha.replace(/^\s*[-•]\s+/, ""))] });
      continue;
    }
    lista = null;
    if (!linha.trim()) continue;
    if (linha.startsWith("## ")) blocos.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: linha.slice(3) }] });
    else if (linha.startsWith("# ")) blocos.push({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: linha.slice(2) }] });
    else blocos.push(paragrafo(linha));
  }
  return { type: "doc", content: blocos };
}

export function documentoEmitidoParaTimbrado(
  d: DocumentoEmitido,
  formatar: { data: (iso: string) => string; dataHora: (iso: string) => string },
): DocumentoTimbrado {
  const tipo = (d.tipo in ROTULO_DO_TIPO ? ROTULO_DO_TIPO[d.tipo as TipoDeDocumento] : "Documento") as string;
  const avisos: AvisoDoDocumento[] = [];
  if (d.status === "revogado") {
    avisos.push({
      estado: "perigo",
      texto: `DOCUMENTO REVOGADO${d.revogacao ? ` EM ${formatar.data(d.revogacao.em)}` : ""} — SEM VALIDADE`,
      emTodasAsPaginas: true,
    });
  } else if (d.status === "cancelado") {
    avisos.push({ estado: "perigo", texto: "DOCUMENTO CANCELADO — SEM VALIDADE", emTodasAsPaginas: true });
  } else if (d.status === "emitido") {
    avisos.push({ estado: "atencao", texto: "Aguardando o aceite do paciente." });
  }

  const corpo = textoParaBlocos(d.conteudo);
  if (d.aceite) {
    corpo.content!.push({
      type: "aviso",
      attrs: { estado: "info" },
      content: [
        {
          type: "text",
          text: `Aceite eletrônico registrado em ${formatar.dataHora(d.aceite.em)} (${d.aceite.canal === "link" ? "pelo link enviado ao paciente" : "presencial"})${d.aceite.nome ? `, por ${d.aceite.nome}` : ""}. Assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I).`,
        },
      ],
    });
  }

  return {
    tipo,
    numero: d.numero ?? d.id.slice(0, 8).toUpperCase(),
    titulo: d.titulo,
    metadados: [
      ["Data", formatar.data(d.criadoEm)],
      ["Destinatário(a)", d.paciente],
      ["Situação", ROTULO_DA_SITUACAO[d.status] ?? d.status],
      ["Validade", d.validadeAte ? formatar.data(d.validadeAte) : null],
      ["Aceite", d.aceite ? `${d.aceite.nome ?? "Paciente"} — ${formatar.dataHora(d.aceite.em)}` : null],
      ["Integridade", `SHA-256 ${d.sha256.slice(0, 16)}…`],
    ],
    avisos,
    corpo,
    emitidoEm: new Date(d.criadoEm),
  };
}
