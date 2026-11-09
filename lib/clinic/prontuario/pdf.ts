/**
 * FORK clinic (prontuário F9) — o prontuário em PDF, no PAPEL TIMBRADO único
 * (lib/documentos, docs/padrao-documentos.md — fase D4).
 *
 * Este arquivo só monta CONTEÚDO: cabeçalho de identificação (paciente,
 * nascimento, emissão, quem gerou, alergias e alertas), cada atendimento em
 * ordem cronológica com todos os registros e adendos, e os termos com o hash.
 * Marca, cores, fontes, cabeçalho e rodapé são do motor. Fotos não entram no
 * PDF (ficam no sistema, com acesso auditado). O aviso de dados de saúde se
 * repete em todas as páginas.
 */
import { valorLegivel } from "@/lib/clinic/formularios/valor-legivel";
import type { NoDoDocumento } from "@/lib/clinic/pops/documento";
import type { AtendimentoNaLinhaDoTempo } from "@/lib/clinic/prontuario/linha-do-tempo";
import type { ContextoDaMarca } from "@/lib/documentos/contexto-da-marca";
import { renderizarDocumento, type DocumentoTimbrado } from "@/lib/documentos/renderizar";

export interface DadosDoPdf {
  paciente: string | null;
  nascimento: string | null;
  alergias: string | null;
  alertas: string | null;
  emitidoEm: string;
  geradoPor: string | null;
  atendimentos: AtendimentoNaLinhaDoTempo[];
  documentos: Array<{ titulo: string; status: string; sha256: string; created_at: string }>;
  t: (s: string) => string;
  data: (iso: string) => string;
}

const texto = (t: string, negrito = false): NoDoDocumento => ({ type: "text", text: t, ...(negrito ? { marks: [{ type: "bold" }] } : {}) });
const titulo = (nivel: 1 | 2 | 3, t: string): NoDoDocumento => ({ type: "heading", attrs: { level: nivel }, content: [texto(t)] });
/** "Rótulo: valor" — some quando o valor está vazio (campo vazio não aparece). */
const linha = (rotulo: string, valor: string | null | undefined): NoDoDocumento | null =>
  valor && valor.trim() ? { type: "paragraph", content: [texto(`${rotulo}: `, true), texto(valor)] } : null;
const dataCurta = (iso: string) => iso.split("-").reverse().join("/");

export function prontuarioParaTimbrado(d: DadosDoPdf): DocumentoTimbrado {
  const { t } = d;
  const corpo: NoDoDocumento[] = [];
  const push = (...nos: (NoDoDocumento | null)[]) => corpo.push(...nos.filter((n): n is NoDoDocumento => Boolean(n)));

  for (const a of [...d.atendimentos].reverse()) {
    const adendos = (alvo: string) =>
      a.adendos
        .filter((x) => x.alvo_id === alvo)
        .map<NoDoDocumento>((x) => ({
          type: "aviso",
          attrs: { estado: "info" },
          content: [texto(`${t("Adendo")} · ${d.data(x.criado_em)}${x.autor ? ` · ${x.autor}` : ""} · ${t("Motivo")}: ${x.motivo} — ${x.texto}`)],
        }));

    push(titulo(2, `${d.data(a.inicio)}${a.servico ? ` · ${a.servico}` : ""}`));
    push({
      type: "paragraph",
      content: [
        texto(
          `${[a.profissional, a.especialidade].filter(Boolean).join(" · ")}${a.fim ? ` · ${t("finalizado em")} ${d.data(a.fim)}` : ` · ${t("em andamento")}`}`,
        ),
      ],
    });
    for (const tipo of ["anamnese", "avaliacao"] as const) {
      const f = a.formularios[tipo];
      if (!f) continue;
      push(titulo(3, `${t(tipo === "anamnese" ? "Anamnese" : "Avaliação")}${f.modelo_nome ? ` — ${t(f.modelo_nome)}` : ""}`));
      for (const c of f.campos) {
        const v = valorLegivel(c, f.respostas[c.chave], t);
        if (v !== "—") push(linha(t(c.rotulo), v));
      }
      push(...adendos(f.id));
    }
    if (a.conduta) {
      push(titulo(3, t("Conduta")));
      push(linha(t("Conduta definida"), a.conduta.descricao), linha(t("Protocolo"), a.conduta.protocolo), linha(t("Recomendações"), a.conduta.recomendacoes));
      push(...adendos(a.conduta.id));
    }
    for (const p of a.procedimentos.filter((x) => x.status !== "anulado")) {
      push(titulo(3, t("Procedimento")));
      push(linha(t("O que foi feito"), p.descricao), linha(t("Região"), p.regiao));
      push(...Object.entries(p.parametros).map(([k, v]) => linha(k, v)));
      push(linha(t("Intercorrências"), p.intercorrencias), linha(t("Observações"), p.observacoes));
      for (const i of p.insumos) {
        push(
          linha(
            t("Insumo"),
            `${i.descricao} · ${i.quantidade} ${i.unidade}${i.lote ? ` · ${t("Lote")} ${i.lote}` : ""}${
              i.registro_anvisa ? ` · ${t("Reg. ANVISA")} ${i.registro_anvisa}` : ""
            }${i.validade ? ` · ${t("Validade")} ${dataCurta(i.validade)}` : ""}`,
          ),
        );
      }
      push(...adendos(p.id));
    }
    if (a.evolucao) {
      push(titulo(3, t("Evolução")));
      push(
        linha(t("Resposta apresentada"), a.evolucao.resposta),
        linha(t("Observações"), a.evolucao.observacoes),
        linha(t("Intercorrências"), a.evolucao.intercorrencias),
        linha(t("Orientações"), a.evolucao.orientacoes),
        linha(t("Próxima conduta"), a.evolucao.proxima_conduta),
      );
      push(...adendos(a.evolucao.id));
    }
  }

  if (d.documentos.length) {
    push(titulo(2, t("Documentos e termos")));
    const celula = (tipo: "tableHeader" | "tableCell", v: string): NoDoDocumento => ({ type: tipo, content: [{ type: "paragraph", content: [texto(v)] }] });
    push({
      type: "table",
      content: [
        { type: "tableRow", content: [t("Data"), t("Documento"), t("Situação"), "SHA-256"].map((v) => celula("tableHeader", v)) },
        ...d.documentos.map<NoDoDocumento>((doc) => ({
          type: "tableRow",
          content: [d.data(doc.created_at), t(doc.titulo), doc.status, `${doc.sha256.slice(0, 16)}…`].map((v) => celula("tableCell", v)),
        })),
      ],
    });
  }

  return {
    tipo: t("Prontuário"),
    titulo: d.paciente ?? t("Paciente"),
    metadados: [
      [t("Data"), d.data(d.emitidoEm)],
      [t("Nascimento"), d.nascimento ? dataCurta(d.nascimento) : null],
      [t("Emitido por"), d.geradoPor],
      [t("Atendimentos"), String(d.atendimentos.length)],
      [t("Alergias informadas"), d.alergias],
    ],
    avisos: [
      ...(d.alertas && d.alertas.trim() ? [{ estado: "perigo" as const, texto: `${t("Alertas")}: ${d.alertas}` }] : []),
      {
        estado: "info",
        texto: t("Documento com dados de saúde. Guarde e compartilhe só com quem tem direito de acesso."),
        emTodasAsPaginas: true,
      },
    ],
    corpo: { type: "doc", content: corpo },
    emitidoEm: new Date(d.emitidoEm),
  };
}

export async function gerarPdfDoProntuario(d: DadosDoPdf, contexto: ContextoDaMarca): Promise<Buffer> {
  return renderizarDocumento(prontuarioParaTimbrado(d), contexto);
}
