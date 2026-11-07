/**
 * FORK clinic (orçamento O3, migration 8008) — o contrato do orçamento em PDF.
 *
 * Gerado no servidor com @react-pdf/renderer (a mesma biblioteca do prontuário).
 * Traz o TEXTO CONGELADO do contrato (o que o paciente aceitou, com itens e
 * forma de pagamento), o sha256 desse texto e o registro do aceite (data, nome
 * digitado, canal). O IP não entra no PDF: fica no sistema. Sem cor de marca.
 */
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827", lineHeight: 1.4 },
  titulo: { fontSize: 15, fontWeight: "bold", marginBottom: 6 },
  miudo: { fontSize: 8.5, color: "#4b5563" },
  h2: { fontSize: 12, fontWeight: "bold", marginTop: 8, marginBottom: 3 },
  paragrafo: { marginBottom: 3 },
  caixa: { marginTop: 14, paddingTop: 8, borderTop: "1pt solid #d1d5db" },
  rodape: { position: "absolute", bottom: 18, left: 40, right: 40, fontSize: 7.5, color: "#6b7280", textAlign: "center" },
});

export interface DadosDoContratoPdf {
  titulo: string;
  conteudo: string;
  sha256: string;
  status: string;
  emitidoEm: string;
  aceite: { nome: string | null; canal: string; em: string } | null;
  data: (iso: string) => string;
}

function Texto({ conteudo }: { conteudo: string }) {
  return (
    <View>
      {conteudo.split("\n").map((linha, i) =>
        linha.startsWith("## ") ? (
          <Text key={i} style={styles.h2}>
            {linha.slice(3)}
          </Text>
        ) : linha.startsWith("# ") ? (
          <Text key={i} style={styles.titulo}>
            {linha.slice(2)}
          </Text>
        ) : (
          <Text key={i} style={styles.paragrafo}>
            {linha || " "}
          </Text>
        ),
      )}
    </View>
  );
}

function ContratoPdf({ d }: { d: DadosDoContratoPdf }) {
  return (
    <Document title={d.titulo}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.miudo}>
          {d.titulo} · emitido em {d.data(d.emitidoEm)}
        </Text>
        <View style={{ marginTop: 10 }}>
          <Texto conteudo={d.conteudo} />
        </View>
        <View style={styles.caixa} wrap={false}>
          <Text style={styles.h2}>Registro</Text>
          {d.aceite ? (
            <Text style={styles.paragrafo}>
              Aceito em {d.data(d.aceite.em)} por {d.aceite.nome ?? "—"} (
              {d.aceite.canal === "link" ? "pelo link enviado ao paciente" : "presencialmente na clínica"}).
            </Text>
          ) : (
            <Text style={styles.paragrafo}>Situação: {d.status}.</Text>
          )}
          <Text style={styles.miudo}>
            Assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I): nome digitado pelo paciente no aceite.
          </Text>
          <Text style={styles.miudo}>Integridade do texto (sha256): {d.sha256}</Text>
        </View>
        <Text
          style={styles.rodape}
          fixed
          render={({ pageNumber, totalPages }) => `${d.titulo} · página ${pageNumber} de ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

export async function gerarPdfDoContrato(d: DadosDoContratoPdf): Promise<Buffer> {
  return renderToBuffer(<ContratoPdf d={d} />);
}
