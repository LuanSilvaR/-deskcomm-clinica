/**
 * FORK clinic (prontuário F9) — o prontuário em PDF, gerado no servidor com
 * @react-pdf/renderer (a mesma biblioteca da exportação LGPD, lib/lgpd).
 *
 * Só texto: cabeçalho (clínica, paciente, emissão, quem gerou, alergias e
 * alertas), cada atendimento em ordem cronológica com todos os registros e
 * adendos, e os termos com o hash. Fotos não entram no PDF (ficam no sistema,
 * com acesso auditado). Sem cor de marca, sem logo.
 */
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import { valorLegivel } from "@/lib/clinic/formularios/valor-legivel";
import type { AtendimentoNaLinhaDoTempo } from "@/lib/clinic/prontuario/linha-do-tempo";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: "Helvetica", color: "#111827" },
  cabecalho: { borderBottom: "1pt solid #d1d5db", paddingBottom: 8, marginBottom: 12 },
  titulo: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  miudo: { fontSize: 8.5, color: "#4b5563" },
  atendimento: { marginTop: 10, paddingTop: 6, borderTop: "0.5pt solid #e5e7eb" },
  h2: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
  h3: { fontSize: 10, fontWeight: "bold", marginTop: 6, marginBottom: 2 },
  linha: { flexDirection: "row", marginBottom: 1 },
  rotulo: { width: 150, color: "#4b5563" },
  valor: { flex: 1 },
  adendo: { marginTop: 3, paddingLeft: 6, borderLeft: "2pt solid #d97706" },
  rodape: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    fontSize: 7.5,
    color: "#6b7280",
    textAlign: "center",
  },
});

export interface DadosDoPdf {
  clinica: string | null;
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

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  if (!valor || !valor.trim()) return null;
  return (
    <View style={styles.linha} wrap={false}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={styles.valor}>{valor}</Text>
    </View>
  );
}

function Adendos({ d, alvo }: { d: DadosDoPdf; alvo: AtendimentoNaLinhaDoTempo["adendos"] }) {
  return (
    <>
      {alvo.map((a) => (
        <View key={a.id} style={styles.adendo} wrap={false}>
          <Text style={styles.miudo}>
            {d.t("Adendo")} · {d.data(a.criado_em)}
            {a.autor ? ` · ${a.autor}` : ""} · {d.t("Motivo")}: {a.motivo}
          </Text>
          <Text>{a.texto}</Text>
        </View>
      ))}
    </>
  );
}

export function DocumentoDoProntuario({ d }: { d: DadosDoPdf }) {
  const { t } = d;
  const cronologico = [...d.atendimentos].reverse();
  return (
    <Document title={`${t("Prontuário")} — ${d.paciente ?? ""}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.cabecalho}>
          <Text style={styles.miudo}>{d.clinica ?? ""}</Text>
          <Text style={styles.titulo}>{t("Prontuário")}</Text>
          <Text>
            {t("Paciente")}: {d.paciente ?? "—"}
            {d.nascimento
              ? ` · ${t("nascimento")} ${d.nascimento.split("-").reverse().join("/")}`
              : ""}
          </Text>
          <Text style={styles.miudo}>
            {t("Emitido em")} {d.data(d.emitidoEm)}
            {d.geradoPor ? ` · ${t("por")} ${d.geradoPor}` : ""} · {d.atendimentos.length}{" "}
            {t("atendimentos")}
          </Text>
          <Linha rotulo={t("Alergias informadas")} valor={d.alergias} />
          <Linha rotulo={t("Alertas")} valor={d.alertas} />
        </View>

        {cronologico.map((a) => {
          const de = (id: string) => a.adendos.filter((x) => x.alvo_id === id);
          return (
            <View key={a.id} style={styles.atendimento}>
              <Text style={styles.h2}>
                {d.data(a.inicio)}
                {a.servico ? ` · ${a.servico}` : ""}
              </Text>
              <Text style={styles.miudo}>
                {[a.profissional, a.especialidade].filter(Boolean).join(" · ")}
                {a.fim ? ` · ${t("finalizado em")} ${d.data(a.fim)}` : ` · ${t("em andamento")}`}
              </Text>
              {(["anamnese", "avaliacao"] as const).map((tipo) => {
                const f = a.formularios[tipo];
                if (!f) return null;
                return (
                  <View key={tipo}>
                    <Text style={styles.h3}>
                      {t(tipo === "anamnese" ? "Anamnese" : "Avaliação")}
                      {f.modelo_nome ? ` — ${t(f.modelo_nome)}` : ""}
                    </Text>
                    {f.campos.map((c) => {
                      const v = valorLegivel(c, f.respostas[c.chave], t);
                      return v === "—" ? null : (
                        <Linha key={c.chave} rotulo={t(c.rotulo)} valor={v} />
                      );
                    })}
                    <Adendos d={d} alvo={de(f.id)} />
                  </View>
                );
              })}
              {a.conduta ? (
                <View>
                  <Text style={styles.h3}>{t("Conduta")}</Text>
                  <Linha rotulo={t("Conduta definida")} valor={a.conduta.descricao} />
                  <Linha rotulo={t("Protocolo")} valor={a.conduta.protocolo} />
                  <Linha rotulo={t("Recomendações")} valor={a.conduta.recomendacoes} />
                  <Adendos d={d} alvo={de(a.conduta.id)} />
                </View>
              ) : null}
              {a.procedimentos
                .filter((p) => p.status !== "anulado")
                .map((p) => (
                  <View key={p.id}>
                    <Text style={styles.h3}>{t("Procedimento")}</Text>
                    <Linha rotulo={t("O que foi feito")} valor={p.descricao} />
                    <Linha rotulo={t("Região")} valor={p.regiao} />
                    {Object.entries(p.parametros).map(([k, v]) => (
                      <Linha key={k} rotulo={k} valor={v} />
                    ))}
                    <Linha rotulo={t("Intercorrências")} valor={p.intercorrencias} />
                    <Linha rotulo={t("Observações")} valor={p.observacoes} />
                    {p.insumos.map((i) => (
                      <Linha
                        key={i.id}
                        rotulo={t("Insumo")}
                        valor={`${i.descricao} · ${i.quantidade} ${i.unidade}${i.lote ? ` · ${t("Lote")} ${i.lote}` : ""}${
                          i.registro_anvisa ? ` · ${t("Reg. ANVISA")} ${i.registro_anvisa}` : ""
                        }${
                          i.validade
                            ? ` · ${t("Validade")} ${i.validade.split("-").reverse().join("/")}`
                            : ""
                        }`}
                      />
                    ))}
                    <Adendos d={d} alvo={de(p.id)} />
                  </View>
                ))}
              {a.evolucao ? (
                <View>
                  <Text style={styles.h3}>{t("Evolução")}</Text>
                  <Linha rotulo={t("Resposta apresentada")} valor={a.evolucao.resposta} />
                  <Linha rotulo={t("Observações")} valor={a.evolucao.observacoes} />
                  <Linha rotulo={t("Intercorrências")} valor={a.evolucao.intercorrencias} />
                  <Linha rotulo={t("Orientações")} valor={a.evolucao.orientacoes} />
                  <Linha rotulo={t("Próxima conduta")} valor={a.evolucao.proxima_conduta} />
                  <Adendos d={d} alvo={de(a.evolucao.id)} />
                </View>
              ) : null}
            </View>
          );
        })}

        {d.documentos.length ? (
          <View style={styles.atendimento}>
            <Text style={styles.h2}>{t("Documentos e termos")}</Text>
            {d.documentos.map((doc) => (
              <Text key={doc.sha256 + doc.created_at} style={styles.miudo}>
                {d.data(doc.created_at)} · {t(doc.titulo)} · {doc.status} · sha256 {doc.sha256}
              </Text>
            ))}
          </View>
        ) : null}

        <Text
          style={styles.rodape}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${t("Documento com dados de saúde. Guarde e compartilhe só com quem tem direito de acesso.")} · ${pageNumber}/${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

export async function gerarPdfDoProntuario(d: DadosDoPdf): Promise<Buffer> {
  return renderToBuffer(<DocumentoDoProntuario d={d} />);
}
