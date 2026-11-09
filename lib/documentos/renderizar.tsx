/**
 * FORK clinic — o MOTOR ÚNICO de documentos: o papel timbrado travado
 * (especificação "Papel timbrado padrão", layoutVersion 2.0.0).
 *
 * Todo documento do sistema (POP, termos, contrato, prontuário, LGPD) passa
 * por aqui. Cada tipo entrega SÓ: tipo, número, título, metadados, avisos,
 * corpo (blocos semânticos) e assinatura. Cabeçalho, rodapé, tipografia, cores
 * e espaçamentos são deste arquivo + `tema.ts` + `paleta.ts`, alimentados pelo
 * `ContextoDaMarca` (Configurações › Organização e › Marca).
 *
 * Cada bloco abaixo cita a chave da especificação que implementa (topBand,
 * header.first, header.compact, footer, openingBlock, signatureBlock,
 * watermark). Regras e divergências: `docs/padrao-documentos.md`.
 *
 * Determinístico: as datas do PDF vêm de `emitidoEm`, nunca do relógio daqui.
 */
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import type { NoDoDocumento } from "@/lib/clinic/pops/documento";

import { Bloco, CaixaDeAviso, estilosDoCorpo } from "./blocos";
import type { ContextoDaMarca } from "./contexto-da-marca";
import { carregarFontes, registrarFontes } from "./fontes";
import { ESTADOS, paraPretoEBranco, type Estado, type Papeis } from "./paleta";
import { ABERTURA, ASSINATURA, CABECALHO, COMPACTO, FAIXA, FAMILIA, MARCA_DAGUA, PAGINA, RODAPE, TIPO, VERSAO_DO_LAYOUT } from "./tema";

export { VERSAO_DO_LAYOUT };

export interface AvisoDoDocumento {
  estado: Estado;
  texto: string;
  /** Repete numa linha discreta acima do rodapé de TODAS as páginas (ex.: "NÃO VIGENTE"). */
  emTodasAsPaginas?: boolean;
  /**
   * Só a linha fixa de cada página, sem a caixa na abertura — para o que tem de
   * aparecer UMA vez por página (ex.: a linha do controlador do relatório LGPD).
   */
  soNaLinhaFixa?: boolean;
}

export interface DocumentoTimbrado {
  /** openingBlock.eyebrow — {{documentType}}: "Declaração", "Contrato"… */
  tipo: string;
  /** openingBlock.eyebrow — {{documentNumber}}: "007/2026". */
  numero?: string | null;
  titulo: string;
  /** openingBlock.metadataTable — valor vazio some (sem rótulo órfão). */
  metadados?: [string, string | null | undefined][];
  avisos?: AvisoDoDocumento[];
  corpo: NoDoDocumento;
  /** signatureBlock — "Atenciosamente," + linha + nome + "cargo  ·  registro". */
  assinatura?: { nome: string; cargo?: string | null; registro?: string | null; fecho?: string | null } | null;
  /** Datas do PDF (determinismo). */
  emitidoEm: Date;
  /** Desligar só com motivo (fax). */
  semMarcaDagua?: boolean;
  /** Variante monocromática para impressão em P&B (também desliga a marca d'água). */
  pretoEBranco?: boolean;
}

/** Linhas sem as vazias, no máximo 3 (footer.maxLinesPerColumn). */
const linhas = (...xs: (string | null | undefined)[]) =>
  xs.filter((x): x is string => Boolean(x && x.trim())).slice(0, RODAPE.maximoDeLinhas);

function estilos(c: Papeis) {
  const ui = { fontFamily: FAMILIA.texto };
  return StyleSheet.create({
    pagina: {
      paddingTop: PAGINA.margemTopo,
      paddingBottom: PAGINA.margemBase,
      paddingHorizontal: PAGINA.margemLateral,
      backgroundColor: c.paper,
      fontFamily: FAMILIA.texto,
      fontSize: TIPO.corpo.tamanho,
      color: c.ink,
    },
    // topBand
    faixa: { position: "absolute", top: 0, left: 0, right: 0 },
    faixaPrimary: { height: FAIXA.primary, backgroundColor: c.primary },
    faixaAccent: { height: FAIXA.accent, marginTop: FAIXA.vao, backgroundColor: c.accent },
    // header (o contêiner fixo é que é absoluto)
    cabecalho: { position: "absolute", top: PAGINA.cabecalhoTopo, left: PAGINA.margemLateral, right: PAGINA.margemLateral },
    linhaDoCabecalho: { flexDirection: "row", alignItems: "center", minHeight: CABECALHO.alturaDoLogo },
    colunaDoLogo: { width: CABECALHO.colunas.logo, height: CABECALHO.alturaDoLogo, justifyContent: "center" },
    colunaDoWordmark: { width: CABECALHO.colunas.wordmark, justifyContent: "center" },
    colunaDoWordmarkSemLogo: { width: CABECALHO.colunas.logo + CABECALHO.colunas.wordmark, justifyContent: "center" },
    nomeDaMarca: {
      fontFamily: FAMILIA.titulo,
      fontWeight: CABECALHO.wordmark.peso,
      fontSize: CABECALHO.wordmark.tamanho,
      // Entrelinha exata de 15 pt (menor que o corpo de 26 pt) faz o react-pdf
      // trocar a fonte e sobrepor o descritor (medido). Linha 1,0 e o descritor
      // puxado para cima dão o mesmo desenho do modelo.
      lineHeight: 1,
      color: c.primary,
    },
    descritor: { ...ui, fontWeight: CABECALHO.descritor.peso, fontSize: CABECALHO.descritor.tamanho, letterSpacing: CABECALHO.descritor.espacamento, color: c.muted, marginTop: 2 },
    colunaDosContatos: { width: CABECALHO.colunas.contatos, alignItems: "flex-end", justifyContent: "center" },
    contatoForte: { ...ui, fontWeight: 700, fontSize: CABECALHO.contatos.tamanho, color: c.ink, textAlign: "right", marginBottom: 4 },
    contato: { ...ui, fontSize: CABECALHO.contatos.tamanho, color: c.muted, textAlign: "right", marginBottom: 4 },
    filete: { borderBottomWidth: CABECALHO.filete, borderBottomColor: c.accent, marginTop: CABECALHO.antesDoFilete },
    // header.compact
    linhaCompacta: { flexDirection: "row", alignItems: "center" },
    favicon: { width: COMPACTO.favicon, height: COMPACTO.favicon, objectFit: "contain", marginRight: 6 },
    nomeCompacto: { flex: 1, fontFamily: FAMILIA.titulo, fontWeight: COMPACTO.nome.peso, fontSize: COMPACTO.nome.tamanho, color: c.primary },
    descritorCompacto: { ...ui, fontWeight: COMPACTO.descritor.peso, fontSize: COMPACTO.descritor.tamanho, letterSpacing: COMPACTO.descritor.espacamento, color: c.muted },
    fileteCompacto: { borderBottomWidth: COMPACTO.filete, borderBottomColor: c.accent, marginTop: COMPACTO.antesDoFilete },
    // footer — sem lineHeight: o react-pdf descarta texto absoluto com lineHeight (medido).
    rodape: {
      position: "absolute",
      bottom: PAGINA.rodapeBase,
      left: PAGINA.margemLateral,
      right: PAGINA.margemLateral,
      borderTopWidth: RODAPE.filete,
      borderTopColor: c.accent,
      paddingTop: RODAPE.depoisDoFilete,
      height: RODAPE.depoisDoFilete + RODAPE.maximoDeLinhas * (TIPO.rodape.tamanho * 1.2 + TIPO.rodape.depois) + 2,
      flexDirection: "row",
    },
    rodapeEsq: { width: RODAPE.colunas.esquerda },
    rodapeDir: { width: RODAPE.colunas.direita, alignItems: "flex-end" },
    rodapeForte: { ...ui, fontWeight: 700, fontSize: TIPO.rodape.tamanho, color: c.ink, marginBottom: TIPO.rodape.depois },
    rodapeTexto: { ...ui, fontSize: TIPO.rodape.tamanho, color: c.muted, marginBottom: TIPO.rodape.depois },
    rodapeTextoDir: { ...ui, fontSize: TIPO.rodape.tamanho, color: c.muted, textAlign: "right", marginBottom: TIPO.rodape.depois },
    negrito: { ...ui, fontWeight: 700 },
    avisoFixo: {
      position: "absolute",
      bottom: PAGINA.margemBase - 14,
      left: PAGINA.margemLateral,
      right: PAGINA.margemLateral,
      ...ui,
      fontWeight: 700,
      fontSize: TIPO.rodape.tamanho,
      textAlign: "center",
    },
    // watermark
    marcaDagua: { position: "absolute", left: MARCA_DAGUA.x, top: MARCA_DAGUA.y, width: MARCA_DAGUA.largura, opacity: MARCA_DAGUA.opacidade },
    // openingBlock
    eyebrow: {
      marginTop: TIPO.eyebrow.antes,
      marginBottom: TIPO.eyebrow.depois,
      ...ui,
      fontWeight: TIPO.eyebrow.peso,
      fontSize: TIPO.eyebrow.tamanho,
      lineHeight: TIPO.eyebrow.entrelinha,
      letterSpacing: TIPO.eyebrow.espacamento,
      color: c.primary,
    },
    titulo: {
      fontFamily: FAMILIA.titulo,
      fontWeight: TIPO.titulo.peso,
      fontSize: TIPO.titulo.tamanho,
      lineHeight: TIPO.titulo.entrelinha,
      color: c.ink,
      marginTop: TIPO.titulo.antes,
      marginBottom: TIPO.titulo.depois,
    },
    meta: { backgroundColor: c.surface, marginBottom: ABERTURA.antesDoCorpo },
    metaLinha: { flexDirection: "row" },
    metaDivisoria: { borderBottomWidth: ABERTURA.divisoria, borderBottomColor: c.border },
    metaRotulo: {
      width: ABERTURA.colunaDoRotulo,
      paddingVertical: ABERTURA.paddingVertical,
      paddingHorizontal: ABERTURA.paddingHorizontal,
      ...ui,
      fontWeight: ABERTURA.rotulo.peso,
      fontSize: ABERTURA.rotulo.tamanho,
      letterSpacing: ABERTURA.rotulo.espacamento,
      color: c.muted,
    },
    metaValor: { flex: 1, paddingVertical: ABERTURA.paddingVertical, paddingHorizontal: ABERTURA.paddingHorizontal, ...ui, fontSize: ABERTURA.valor.tamanho, color: c.ink },
    // signatureBlock
    assinatura: { marginTop: ASSINATURA.antesDoFecho },
    fecho: { ...ui, fontSize: TIPO.corpo.tamanho, lineHeight: TIPO.corpo.entrelinha, color: c.ink },
    linhaDaAssinatura: {
      width: ASSINATURA.larguraDaLinha,
      borderTopWidth: ASSINATURA.espessura,
      borderTopColor: c.ink,
      marginTop: ASSINATURA.antesDaLinha,
      marginBottom: ASSINATURA.depoisDaLinha,
    },
    nomeDaAssinatura: { ...ui, fontWeight: ASSINATURA.nome.peso, fontSize: ASSINATURA.nome.tamanho, color: c.ink },
    cargo: { ...ui, fontSize: ASSINATURA.cargo.tamanho, color: c.muted, marginTop: 3 },
  });
}
type Estilos = ReturnType<typeof estilos>;

/** O símbolo cabe em 25 × 19 mm, com a proporção preservada (react-pdf exige tamanho explícito). */
function tamanhoDoSimbolo(img: { largura: number; altura: number }) {
  const proporcao = img.largura / img.altura;
  const altura = Math.min(CABECALHO.alturaDoLogo, CABECALHO.larguraMaximaDoLogo / proporcao);
  return { width: altura * proporcao, height: altura };
}

/** topBand — faixa primary 3,9 mm, vão 0,6 mm, filete accent 0,7 mm, sangrada. */
function Faixa({ s }: { s: Estilos }) {
  return (
    <View fixed style={s.faixa}>
      <View style={s.faixaPrimary} />
      <View style={s.faixaAccent} />
    </View>
  );
}

/** header.first — [símbolo 25 mm] [wordmark 75,8 mm] [contatos 69,2 mm] + filete accent. */
function CabecalhoCompleto({ ctx, s }: { ctx: ContextoDaMarca; s: Estilos }) {
  return (
    <View>
      <View style={s.linhaDoCabecalho}>
        {ctx.simbolo ? (
          <View style={s.colunaDoLogo}>
            <Image style={tamanhoDoSimbolo(ctx.simbolo)} src={{ data: ctx.simbolo.data, format: ctx.simbolo.format }} />
          </View>
        ) : null}
        <View style={ctx.simbolo ? s.colunaDoWordmark : s.colunaDoWordmarkSemLogo}>
          <Text style={s.nomeDaMarca}>{ctx.nomeDaMarca}</Text>
          {ctx.descritor ? <Text style={s.descritor}>{ctx.descritor.toUpperCase()}</Text> : null}
        </View>
        <View style={s.colunaDosContatos}>
          {ctx.site ? <Text style={s.contatoForte}>{ctx.site.exibir}</Text> : null}
          {ctx.contatos.map((l) => (
            <Text key={l} style={s.contato}>
              {l}
            </Text>
          ))}
          {ctx.cidadeUf ? <Text style={s.contato}>{ctx.cidadeUf}</Text> : null}
        </View>
      </View>
      <View style={s.filete} />
    </View>
  );
}

/** header.compact — favicon 6 mm + nome; descritor à direita; filete accent. */
function CabecalhoCompacto({ ctx, s }: { ctx: ContextoDaMarca; s: Estilos }) {
  const icone = ctx.favicon ?? ctx.simbolo;
  return (
    <View>
      <View style={s.linhaCompacta}>
        {icone ? <Image style={s.favicon} src={{ data: icone.data, format: icone.format }} /> : null}
        <Text style={s.nomeCompacto}>{ctx.nomeDaMarca}</Text>
        {ctx.descritor ? <Text style={s.descritorCompacto}>{ctx.descritor.toUpperCase()}</Text> : null}
      </View>
      <View style={s.fileteCompacto} />
    </View>
  );
}

/** footer — esquerda: razão social, CNPJ, responsável; direita: endereço, cidade/UF/CEP, página. */
function Rodape({ ctx, s }: { ctx: ContextoDaMarca; s: Estilos }) {
  const esquerda = linhas(ctx.cnpj ? `CNPJ ${ctx.cnpj}` : null, ctx.responsavel).slice(0, RODAPE.maximoDeLinhas - 1);
  const direita = linhas(ctx.enderecoLinha, ctx.cidadeUfCep).slice(0, RODAPE.maximoDeLinhas - 1);
  return (
    <View fixed style={s.rodape}>
      <View style={s.rodapeEsq}>
        <Text style={s.rodapeForte}>{ctx.razaoSocial}</Text>
        {esquerda.map((l) => (
          <Text key={l} style={s.rodapeTexto}>
            {l}
          </Text>
        ))}
      </View>
      <View style={s.rodapeDir}>
        {direita.map((l) => (
          <Text key={l} style={s.rodapeTextoDir}>
            {l}
          </Text>
        ))}
        <Text
          style={s.rodapeTextoDir}
          render={({ pageNumber, totalPages }) => (
            <>
              Página <Text style={s.negrito}>{pageNumber}</Text> de <Text style={s.negrito}>{totalPages}</Text>
            </>
          )}
        />
      </View>
    </View>
  );
}

/** Espaço da página 1 sob o cabeçalho completo (absoluto): até logo abaixo do filete. */
const ESPACO_DO_CABECALHO_COMPLETO =
  PAGINA.cabecalhoTopo + CABECALHO.alturaDoLogo + CABECALHO.antesDoFilete + CABECALHO.filete - PAGINA.margemTopo;

export function DocumentoPdf({ doc, contexto }: { doc: DocumentoTimbrado; contexto: ContextoDaMarca }) {
  registrarFontes();
  const cores = doc.pretoEBranco ? paraPretoEBranco(contexto.cores) : contexto.cores;
  const s = estilos(cores);
  const corpo = estilosDoCorpo(cores);
  const metadados = (doc.metadados ?? []).filter((m): m is [string, string] => Boolean(m[1] && m[1].trim()));
  const fixos = (doc.avisos ?? []).filter((a) => a.emTodasAsPaginas);
  const marcaDagua = !doc.semMarcaDagua && !doc.pretoEBranco ? contexto.marcaDagua : null;
  const eyebrow = `${doc.tipo}${doc.numero ? `${ABERTURA.separadorDoEyebrow}Nº ${doc.numero}` : ""}`.toUpperCase();
  const cargo = linhas(doc.assinatura?.cargo, doc.assinatura?.registro).join(ASSINATURA.separador);

  return (
    <Document
      title={`${doc.titulo} — ${contexto.nomeDaMarca}`}
      author={contexto.nomeDaMarca}
      subject={doc.tipo}
      creator={contexto.nomeDaMarca}
      producer={`${contexto.nomeDaMarca} · papel timbrado ${VERSAO_DO_LAYOUT}`}
      language="pt-BR"
      creationDate={doc.emitidoEm}
      modificationDate={doc.emitidoEm}
    >
      <Page size={PAGINA.tamanho} style={s.pagina}>
        {/* watermark — primeiro, para ficar atrás do texto; `fixed` = em TODAS as páginas
            (decisão do dono do produto, 2026-11-09 — a especificação 2.0.0 previa só a 1ª). */}
        {marcaDagua ? <Image fixed style={s.marcaDagua} src={{ data: marcaDagua.data, format: marcaDagua.format }} /> : null}
        <Faixa s={s} />
        <View
          fixed
          style={s.cabecalho}
          render={({ pageNumber }) => (pageNumber === 1 ? <CabecalhoCompleto ctx={contexto} s={s} /> : <CabecalhoCompacto ctx={contexto} s={s} />)}
        />

        <View style={{ height: ESPACO_DO_CABECALHO_COMPLETO }} />
        {/* openingBlock: eyebrow → título → tabela de metadados → corpo */}
        <Text style={s.eyebrow} minPresenceAhead={80}>
          {eyebrow}
        </Text>
        <Text style={s.titulo}>{doc.titulo}</Text>
        {metadados.length ? (
          <View style={s.meta}>
            {metadados.map(([rotulo, valor], i) => (
              <View key={rotulo} wrap={false} style={i < metadados.length - 1 ? [s.metaLinha, s.metaDivisoria] : s.metaLinha}>
                <Text style={s.metaRotulo}>{rotulo.toUpperCase()}</Text>
                <Text style={s.metaValor}>{valor}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {(doc.avisos ?? [])
          .filter((a) => !a.soNaLinhaFixa)
          .map((a) => (
            <CaixaDeAviso key={a.texto} estado={a.estado} texto={a.texto} />
          ))}

        {(doc.corpo.content ?? []).map((n, i) => (
          <Bloco key={`b${i}`} no={n} s={corpo} chave={`b${i}`} />
        ))}

        {/* signatureBlock — o bloco inteiro junto: "Atenciosamente," nunca fica sozinho. */}
        {doc.assinatura ? (
          <View style={s.assinatura} wrap={false}>
            <Text style={s.fecho}>{doc.assinatura.fecho ?? ASSINATURA.fecho}</Text>
            <View style={s.linhaDaAssinatura} />
            <Text style={s.nomeDaAssinatura}>{doc.assinatura.nome}</Text>
            {cargo ? <Text style={s.cargo}>{cargo}</Text> : null}
          </View>
        ) : null}

        {fixos.map((a) => (
          <Text key={`fixo-${a.texto}`} fixed style={[s.avisoFixo, { color: ESTADOS[a.estado].texto }]}>
            {a.texto}
          </Text>
        ))}
        <Rodape ctx={contexto} s={s} />
      </Page>
    </Document>
  );
}

export async function renderizarDocumento(doc: DocumentoTimbrado, contexto: ContextoDaMarca): Promise<Buffer> {
  await carregarFontes();
  return renderToBuffer(<DocumentoPdf doc={doc} contexto={contexto} />);
}
