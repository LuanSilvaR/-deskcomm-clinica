/**
 * FORK clinic (9015) — o RENDERIZADOR DE DOCUMENTO: dados + JSON do editor → PDF A4.
 *
 * Genérico de propósito: o POP é o primeiro, e contratos, consentimentos e
 * orientações podem usar o mesmo molde (marca, bloco documental na 1ª página,
 * cabeçalho compacto nas seguintes, rodapé paginado, faixa de aviso).
 *
 * O conteúdo é a árvore já VALIDADA (lib/clinic/pops/documento.ts) — lista
 * fechada de nós, sem HTML — renderizada nó a nó em componentes do react-pdf.
 * Nada é interpretado como marcação: texto é sempre texto.
 *
 * Fonte: Helvetica padrão do PDF (WinAnsi) cobre português e espanhol; caracteres
 * fora dela viram "?" em vez de quebrar o arquivo. Cor: só hex (o react-pdf
 * descarta `var()`/`oklch()` em silêncio — ver lib/lgpd/pdf-renderer.tsx).
 */
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import type { NoDoDocumento } from "@/lib/clinic/pops/documento";

export interface MarcaDoDocumento {
  nome: string;
  razaoSocial?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  /** PNG/JPG já baixado (o react-pdf não busca URL do jeito que precisamos). */
  logo?: { data: Buffer; format: "png" | "jpg" } | null;
  /** #RRGGBB; inválido cai no neutro. */
  cor?: string | null;
}

export interface DadosDoDocumento {
  marca: MarcaDoDocumento;
  /** "PROCEDIMENTO OPERACIONAL PADRÃO — POP". */
  titulo: string;
  /** Linha em destaque sob o título (ex.: o nome do procedimento). */
  subtitulo: string;
  /** Pares da 1ª página (código, versão, status…). */
  identificacao: [string, string][];
  /** Pares de controle (criado, atualizado, aprovado…). */
  controle: [string, string][];
  /** Cabeçalho compacto das páginas seguintes (linhas). */
  cabecalhoCompacto: string[];
  /** Rodapé: recebe a página e o total. */
  rodape: (pagina: number, total: number) => string;
  /** Faixa de aviso no topo e no rodapé (ex.: "VERSÃO 1.0 — SUBSTITUÍDA — NÃO VIGENTE"). */
  faixa?: string | null;
  conteudo: NoDoDocumento;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const NEUTRO = "#1f2937";

/** Só o que a Helvetica padrão (WinAnsi) desenha; o resto vira "?". */
export function paraWinAnsi(texto: string): string {
  const extras = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
  let saida = "";
  for (const ch of texto.normalize("NFC")) {
    const c = ch.codePointAt(0) ?? 0;
    saida += c === 10 || c === 9 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || extras.includes(ch) ? ch : "?";
  }
  return saida;
}

function estilos(cor: string) {
  return StyleSheet.create({
    pagina: { paddingTop: 64, paddingBottom: 56, paddingHorizontal: 44, fontSize: 10, fontFamily: "Helvetica", color: NEUTRO },
    compacto: { position: "absolute", top: 22, left: 44, right: 44, borderBottom: `1pt solid ${cor}`, paddingBottom: 4, fontSize: 8, color: "#4b5563" },
    faixaTopo: { position: "absolute", top: 8, left: 44, right: 44, textAlign: "center", fontSize: 8, color: "#991b1b", fontFamily: "Helvetica-Bold" },
    rodapeLinha: { position: "absolute", bottom: 36, left: 44, right: 44, borderTop: "0.5pt solid #d1d5db" },
    rodape: { position: "absolute", bottom: 22, left: 44, right: 44, fontSize: 8, color: "#4b5563" },
    bloco: { border: `1pt solid ${cor}`, borderRadius: 4, marginBottom: 16 },
    blocoTopo: { flexDirection: "row", alignItems: "center", padding: 10, borderBottom: `1pt solid ${cor}` },
    logo: { width: 90, height: 45, objectFit: "contain", marginRight: 12 },
    clinica: { fontSize: 13, fontFamily: "Helvetica-Bold" },
    clinicaDetalhe: { fontSize: 8, color: "#4b5563" },
    titulo: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", padding: 6, color: cor, borderBottom: `1pt solid ${cor}` },
    subtitulo: { fontSize: 12, fontFamily: "Helvetica-Bold", paddingHorizontal: 10, paddingTop: 8 },
    grade: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, paddingVertical: 6 },
    par: { width: "50%", paddingVertical: 2 },
    rotulo: { fontSize: 7, color: "#6b7280", textTransform: "uppercase" },
    valor: { fontSize: 9.5 },
    separador: { borderTop: `0.5pt solid ${cor}`, marginHorizontal: 10 },
    faixaNoBloco: { margin: 10, marginBottom: 0, padding: 6, backgroundColor: "#fef2f2", color: "#991b1b", fontFamily: "Helvetica-Bold", textAlign: "center", fontSize: 10 },
    h1: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4, color: cor },
    h2: { fontSize: 12.5, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 3, color: cor },
    h3: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 2 },
    // lineHeight fica no CONTEÚDO, não na página: na página, o react-pdf descarta
    // o texto dinâmico com posição absoluta (o rodapé "Página X de Y" sumia).
    p: { marginVertical: 2, lineHeight: 1.45 },
    lista: { marginVertical: 2 },
    item: { flexDirection: "row", marginVertical: 1, lineHeight: 1.45 },
    marcador: { width: 16 },
    itemCorpo: { flex: 1 },
    hr: { borderTop: "0.5pt solid #9ca3af", marginVertical: 8 },
    tabela: { borderTop: "0.5pt solid #9ca3af", borderLeft: "0.5pt solid #9ca3af", marginVertical: 6 },
    linha: { flexDirection: "row" },
    celula: { flex: 1, borderRight: "0.5pt solid #9ca3af", borderBottom: "0.5pt solid #9ca3af", padding: 3 },
    celulaCabecalho: { flex: 1, borderRight: "0.5pt solid #9ca3af", borderBottom: "0.5pt solid #9ca3af", padding: 3, backgroundColor: "#f3f4f6" },
  });
}

type Estilos = ReturnType<typeof estilos>;

function fonteDasMarcas(marks: { type: string }[] | undefined): string {
  const b = marks?.some((m) => m.type === "bold");
  const i = marks?.some((m) => m.type === "italic");
  return b && i ? "Helvetica-BoldOblique" : b ? "Helvetica-Bold" : i ? "Helvetica-Oblique" : "Helvetica";
}

/** Os filhos em linha de um parágrafo/título: texto com marcas e quebras. */
function emLinha(nos: NoDoDocumento[] | undefined, chave: string): React.ReactNode[] {
  return (nos ?? []).map((n, i) => {
    if (n.type === "hardBreak") return "\n";
    if (n.type !== "text" || !n.text) return null;
    const sublinhado = n.marks?.some((m) => m.type === "underline");
    return (
      <Text key={`${chave}-${i}`} style={{ fontFamily: fonteDasMarcas(n.marks), textDecoration: sublinhado ? "underline" : "none" }}>
        {paraWinAnsi(n.text)}
      </Text>
    );
  });
}

function bloco(n: NoDoDocumento, s: Estilos, chave: string, ordem?: number): React.ReactNode {
  const filhos = n.content ?? [];
  switch (n.type) {
    case "heading": {
      const nivel = (n.attrs?.level as number | undefined) ?? 2;
      return (
        <Text key={chave} style={nivel === 1 ? s.h1 : nivel === 2 ? s.h2 : s.h3} minPresenceAhead={40}>
          {emLinha(filhos, chave)}
        </Text>
      );
    }
    case "paragraph":
      return (
        <Text key={chave} style={s.p}>
          {filhos.length ? emLinha(filhos, chave) : " "}
        </Text>
      );
    case "bulletList":
    case "orderedList": {
      const inicio = (n.attrs?.start as number | undefined) ?? 1;
      return (
        <View key={chave} style={s.lista}>
          {filhos.map((f, i) => bloco(f, s, `${chave}-${i}`, n.type === "orderedList" ? inicio + i : undefined))}
        </View>
      );
    }
    case "listItem":
      return (
        <View key={chave} style={s.item} wrap={false}>
          <Text style={s.marcador}>{ordem !== undefined ? `${ordem}.` : "•"}</Text>
          <View style={s.itemCorpo}>{filhos.map((f, i) => bloco(f, s, `${chave}-${i}`))}</View>
        </View>
      );
    case "table":
      return (
        <View key={chave} style={s.tabela}>
          {filhos.map((linha, i) => (
            <View key={`${chave}-${i}`} style={s.linha} wrap={false}>
              {(linha.content ?? []).map((cel, j) => (
                <View key={`${chave}-${i}-${j}`} style={cel.type === "tableHeader" ? s.celulaCabecalho : s.celula}>
                  {(cel.content ?? []).map((f, k) => bloco(f, s, `${chave}-${i}-${j}-${k}`))}
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    case "horizontalRule":
      return <View key={chave} style={s.hr} />;
    case "quebraDePagina":
      return <View key={chave} break />;
    default:
      return null;
  }
}

function Par({ rotulo, valor, s }: { rotulo: string; valor: string; s: Estilos }) {
  return (
    <View style={s.par}>
      <Text style={s.rotulo}>{paraWinAnsi(rotulo)}</Text>
      <Text style={s.valor}>{paraWinAnsi(valor)}</Text>
    </View>
  );
}

export function DocumentoPdf({ dados }: { dados: DadosDoDocumento }) {
  const cor = dados.marca.cor && HEX.test(dados.marca.cor) ? dados.marca.cor : NEUTRO;
  const s = estilos(cor);
  const m = dados.marca;
  const detalhes = [m.razaoSocial && m.razaoSocial !== m.nome ? m.razaoSocial : null, m.cnpj ? `CNPJ ${m.cnpj}` : null, m.endereco ?? null].filter(Boolean) as string[];
  return (
    <Document title={paraWinAnsi(`${dados.titulo} — ${dados.subtitulo}`)} author={paraWinAnsi(m.nome)} language="pt-BR">
      <Page size="A4" style={s.pagina}>
        {dados.faixa ? <Text fixed style={s.faixaTopo}>{paraWinAnsi(dados.faixa)}</Text> : null}
        <View fixed style={s.compacto} render={({ pageNumber }) => (pageNumber > 1 ? <Text>{paraWinAnsi(dados.cabecalhoCompacto.join("  ·  "))}</Text> : null)} />

        <View style={s.bloco}>
          <View style={s.blocoTopo}>
            {m.logo ? <Image style={s.logo} src={{ data: m.logo.data, format: m.logo.format }} /> : null}
            <View>
              <Text style={s.clinica}>{paraWinAnsi(m.nome)}</Text>
              {detalhes.map((d) => (
                <Text key={d} style={s.clinicaDetalhe}>
                  {paraWinAnsi(d)}
                </Text>
              ))}
            </View>
          </View>
          <Text style={s.titulo}>{paraWinAnsi(dados.titulo)}</Text>
          {dados.faixa ? <Text style={s.faixaNoBloco}>{paraWinAnsi(dados.faixa)}</Text> : null}
          <Text style={s.subtitulo}>{paraWinAnsi(dados.subtitulo)}</Text>
          <View style={s.grade}>
            {dados.identificacao.map(([r, v]) => (
              <Par key={r} rotulo={r} valor={v} s={s} />
            ))}
          </View>
          <View style={s.separador} />
          <View style={s.grade}>
            {dados.controle.map(([r, v]) => (
              <Par key={r} rotulo={r} valor={v} s={s} />
            ))}
          </View>
        </View>

        {(dados.conteudo.content ?? []).map((n, i) => bloco(n, s, `b${i}`))}

        <View fixed style={s.rodapeLinha} />
        <Text
          fixed
          style={s.rodape}
          render={({ pageNumber, totalPages }) => paraWinAnsi(`${dados.faixa ? `${dados.faixa}  ·  ` : ""}${dados.rodape(pageNumber, totalPages)}`)}
        />
      </Page>
    </Document>
  );
}

export async function renderizarDocumento(dados: DadosDoDocumento): Promise<Buffer> {
  return renderToBuffer(<DocumentoPdf dados={dados} />);
}
