/**
 * Atestado de anonimização (LGPD, #87) no papel timbrado único. Este arquivo só
 * monta CONTEÚDO; marca, cabeçalho e rodapé são do motor (lib/documentos).
 * Não recebe nem imprime nome de paciente: o titular aparece só pelo protocolo.
 */
import type { NoDoDocumento } from "@/lib/clinic/pops/documento";
import type { DocumentoTimbrado } from "@/lib/documentos/renderizar";

import { dataHoraNoFuso, itensAnonimizados, linhasRetidas, textoDaDeclaracao, type DadosDoAtestado } from "./atestado";

const texto = (t: string, negrito = false): NoDoDocumento => ({
  type: "text",
  text: t,
  ...(negrito ? { marks: [{ type: "bold" }] } : {}),
});
const paragrafo = (t: string): NoDoDocumento => ({ type: "paragraph", content: [texto(t)] });
const rotulado = (rotulo: string, valor: string): NoDoDocumento => ({
  type: "paragraph",
  content: [texto(`${rotulo}: `, true), texto(valor)],
});
const secao = (t: string): NoDoDocumento => ({ type: "heading", attrs: { level: 2 }, content: [texto(t)] });
const lista = (itens: string[]): NoDoDocumento => ({
  type: "bulletList",
  content: itens.map((i) => ({ type: "listItem", content: [paragrafo(i)] })),
});

export function montarDocumentoDoAtestado(
  d: DadosDoAtestado,
  codigo: { curto: string; algoritmo: "hmac-sha256" | "sha256" },
): DocumentoTimbrado {
  const retidas = linhasRetidas(d.retidos);
  const rotuloDoCodigo = codigo.algoritmo === "hmac-sha256" ? "Código de autenticidade" : "Código de integridade";
  const executor = [d.executor.nome, d.executor.papel].filter(Boolean).join(" · ");

  const corpo: NoDoDocumento[] = [
    rotulado("Protocolo", d.atestado_id),
    paragrafo(textoDaDeclaracao(d)),
    secao("O que foi anonimizado"),
    lista(itensAnonimizados()),
    secao("O que foi retido e por quê"),
    retidas.length > 0
      ? lista(retidas.map((l) => `${l.rotulo}: ${l.quantidade} registro(s). Motivo: ${l.motivo}.`))
      : paragrafo("Nenhum registro foi retido por obrigação legal."),
    secao("Execução"),
    rotulado("Responsável", executor),
    rotulado("IP", d.ip ?? "não registrado"),
    rotulado("Data do ato", dataHoraNoFuso(d.anonimizado_em, d.fuso)),
    rotulado("Data de emissão", dataHoraNoFuso(d.emitido_em, d.fuso)),
    rotulado(rotuloDoCodigo, codigo.curto),
    paragrafo("A autenticidade deste código pode ser confirmada pela clínica, mediante solicitação ao seu encarregado (DPO)."),
  ];

  return {
    tipo: "Atestado",
    numero: null,
    titulo: "Atestado de Anonimização",
    metadados: [["Protocolo", d.atestado_id]],
    corpo: { type: "doc", content: corpo },
    emitidoEm: new Date(d.emitido_em),
  };
}
