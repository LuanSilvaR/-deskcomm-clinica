/**
 * FORK clinic — o MOTOR ÚNICO de documentos: o papel timbrado travado.
 *
 * Todo documento do sistema (POP, termos, contrato, prontuário, LGPD) passa
 * por aqui. Cada tipo entrega SÓ: tipo, número, título, metadados, avisos,
 * corpo (blocos semânticos) e assinatura. Cabeçalho, rodapé, tipografia, cores
 * e espaçamentos são deste arquivo + `tema.ts` + `paleta.ts`, alimentados pelo
 * `ContextoDaMarca` (Configurações › Organização e › Marca).
 *
 * Referência visual: `Farias_Rocha_Papel_Timbrado_v2.pdf`. Regras, contrato e
 * divergências: `docs/padrao-documentos.md`.
 *
 * Determinístico: as datas do PDF (criação/modificação) vêm de `emitidoEm`,
 * nunca do relógio daqui — mesmo conteúdo + mesmo contexto = mesmo arquivo.
 */
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import type { NoDoDocumento } from "@/lib/clinic/pops/documento";

import { Bloco, CaixaDeAviso, estilosDoCorpo } from "./blocos";
import type { ContextoDaMarca } from "./contexto-da-marca";
import { registrarFontes } from "./fontes";
import { ESTADOS, paraPretoEBranco, type Estado, type Papeis } from "./paleta";
import { ABERTURA, ASSINATURA, CABECALHO, COMPACTO, FAIXA, FAMILIA, MARCA_DAGUA, PAGINA, RODAPE, TIPO, VERSAO_DO_LAYOUT } from "./tema";

export { VERSAO_DO_LAYOUT };

export interface AvisoDoDocumento {
  estado: Estado;
  texto: string;
  /** Repete numa linha discreta acima do rodapé de TODAS as páginas (ex.: "NÃO VIGENTE"). */
  emTodasAsPaginas?: boolean;
}

export interface DocumentoTimbrado {
  /** Eyebrow: "PROCEDIMENTO OPERACIONAL PADRÃO", "CONTRATO"… */
  tipo: string;
  /** Depois de "Nº " no eyebrow: "007/2026", "POP-007 · v2.0". */
  numero?: string | null;
  titulo: string;
  /** Linhas da tabela de abertura. Valor vazio some (sem rótulo órfão). */
  metadados?: [string, string | null | undefined][];
  avisos?: AvisoDoDocumento[];
  corpo: NoDoDocumento;
  /** Fechamento "Atenciosamente," + linha + nome + cargo/registro. */
  assinatura?: { nome: string; cargo?: string | null; fecho?: string | null } | null;
  /** Datas do PDF (determinismo). */
  emitidoEm: Date;
  /** Desligar só com motivo (fax, P&B). */
  semMarcaDagua?: boolean;
  /** Variante monocromática para impressão em P&B. */
  pretoEBranco?: boolean;
}

function estilos(c: Papeis) {
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
    faixa: { position: "absolute", top: 0, left: 0, right: 0 },
    faixaPrimary: { height: FAIXA.primary, backgroundColor: c.primary },
    faixaAccent: { height: FAIXA.accent, marginTop: FAIXA.vao, backgroundColor: c.accent },
    cabecalho: {
      position: "absolute",
      top: PAGINA.cabecalhoTopo,
      left: PAGINA.margemLateral,
      right: PAGINA.margemLateral,
    },
    cabecalhoInterno: {},
    linhaDoCabecalho: { flexDirection: "row", alignItems: "center", minHeight: CABECALHO.alturaDoLogo },
    colunaDoLogo: { width: CABECALHO.colunaDoLogo, height: CABECALHO.alturaDoLogo, justifyContent: "center" },
    wordmark: { flex: 1, paddingLeft: 6 },
    nomeDaMarca: { fontFamily: FAMILIA.titulo, fontWeight: CABECALHO.wordmark.peso, fontSize: CABECALHO.wordmark.tamanho, lineHeight: 1, color: c.primary },
    descritor: { fontFamily: FAMILIA.texto, fontWeight: CABECALHO.descritor.peso, fontSize: CABECALHO.descritor.tamanho, letterSpacing: CABECALHO.descritor.espacamento, color: c.muted, marginTop: 2 },
    contatos: { width: PAGINA.larguraUtil * 0.36, alignItems: "flex-end" },
    contatoForte: { fontFamily: FAMILIA.texto, fontWeight: 700, fontSize: CABECALHO.contatos.tamanho, lineHeight: CABECALHO.contatos.entrelinha, color: c.ink, textAlign: "right" },
    contato: { fontFamily: FAMILIA.texto, fontSize: CABECALHO.contatos.tamanho, lineHeight: CABECALHO.contatos.entrelinha, color: c.muted, textAlign: "right" },
    filete: { borderBottomWidth: CABECALHO.filete, borderBottomColor: c.accent, marginTop: CABECALHO.distanciaDoFilete },
    linhaCompacta: { flexDirection: "row", alignItems: "center" },
    favicon: { width: COMPACTO.favicon, height: COMPACTO.favicon, objectFit: "contain", marginRight: 6 },
    nomeCompacto: { flex: 1, fontFamily: FAMILIA.titulo, fontWeight: COMPACTO.nome.peso, fontSize: COMPACTO.nome.tamanho, color: c.primary },
    descritorCompacto: { fontFamily: FAMILIA.texto, fontWeight: COMPACTO.descritor.peso, fontSize: COMPACTO.descritor.tamanho, letterSpacing: COMPACTO.descritor.espacamento, color: c.muted },
    fileteCompacto: { borderBottomWidth: COMPACTO.filete, borderBottomColor: c.accent, marginTop: COMPACTO.distanciaDoFilete },
    rodape: {
      position: "absolute",
      bottom: PAGINA.rodapeBase,
      left: PAGINA.margemLateral,
      right: PAGINA.margemLateral,
      borderTopWidth: RODAPE.filete,
      borderTopColor: c.accent,
      paddingTop: RODAPE.distanciaDoFilete,
      height: RODAPE.distanciaDoFilete + 3 * RODAPE.tamanho * RODAPE.entrelinha + 2,
      flexDirection: "row",
    },
    rodapeEsq: { width: RODAPE.colunaEsquerda },
    rodapeDir: { width: RODAPE.colunaDireita, alignItems: "flex-end" },
    rodapeForte: { marginBottom: 2, fontFamily: FAMILIA.texto, fontWeight: 700, fontSize: RODAPE.tamanho, color: c.ink },
    rodapeTexto: { marginBottom: 2, fontFamily: FAMILIA.texto, fontSize: RODAPE.tamanho, color: c.muted },
    rodapeTextoDir: { marginBottom: 2, fontFamily: FAMILIA.texto, fontSize: RODAPE.tamanho, color: c.muted, textAlign: "right" },
    avisoFixo: {
      position: "absolute",
      bottom: PAGINA.margemBase - 14,
      left: PAGINA.margemLateral,
      right: PAGINA.margemLateral,
      fontFamily: FAMILIA.texto,
      fontWeight: 700,
      fontSize: TIPO.auxiliar.tamanho,
      textAlign: "center",
    },
    marcaDagua: { position: "absolute", left: MARCA_DAGUA.x, top: MARCA_DAGUA.y, width: MARCA_DAGUA.largura, opacity: MARCA_DAGUA.opacidade },
    eyebrow: {
      marginTop: TIPO.eyebrow.antes,
      fontFamily: FAMILIA.texto,
      fontWeight: TIPO.eyebrow.peso,
      fontSize: TIPO.eyebrow.tamanho,
      letterSpacing: TIPO.eyebrow.espacamento,
      color: c.primary,
    },
    titulo: {
      fontFamily: FAMILIA.titulo,
      fontWeight: TIPO.titulo.peso,
      fontSize: TIPO.titulo.tamanho,
      lineHeight: TIPO.titulo.entrelinha,
      color: c.ink,
      marginTop: 4,
      marginBottom: TIPO.titulo.depois,
    },
    meta: { backgroundColor: c.surface, marginBottom: ABERTURA.depoisDaTabela },
    metaLinha: { flexDirection: "row" },
    metaDivisoria: { borderBottomWidth: ABERTURA.divisoria, borderBottomColor: c.border },
    metaRotulo: {
      width: ABERTURA.colunaDoRotulo,
      paddingVertical: ABERTURA.paddingVertical,
      paddingHorizontal: ABERTURA.paddingHorizontal,
      fontFamily: FAMILIA.texto,
      fontWeight: ABERTURA.rotulo.peso,
      fontSize: ABERTURA.rotulo.tamanho,
      letterSpacing: ABERTURA.rotulo.espacamento,
      color: c.muted,
    },
    metaValor: {
      flex: 1,
      paddingVertical: ABERTURA.paddingVertical,
      paddingHorizontal: ABERTURA.paddingHorizontal,
      fontFamily: FAMILIA.texto,
      fontSize: ABERTURA.valor.tamanho,
      color: c.ink,
    },
    assinatura: { marginTop: ASSINATURA.antesDoFecho },
    fecho: { fontFamily: FAMILIA.texto, fontSize: TIPO.corpo.tamanho, color: c.ink },
    linhaDaAssinatura: { width: ASSINATURA.larguraDaLinha, borderTopWidth: ASSINATURA.espessura, borderTopColor: c.ink, marginTop: ASSINATURA.antesDaLinha, marginBottom: 6 },
    nomeDaAssinatura: { fontFamily: FAMILIA.texto, fontWeight: 700, fontSize: TIPO.corpo.tamanho, color: c.ink },
    cargo: { fontFamily: FAMILIA.texto, fontSize: ASSINATURA.cargo.tamanho, color: c.muted, marginTop: 2 },
  });
}
type Estilos = ReturnType<typeof estilos>;

function Faixa({ s }: { s: Estilos }) {
  return (
    <View fixed style={s.faixa}>
      <View style={s.faixaPrimary} />
      <View style={s.faixaAccent} />
    </View>
  );
}

/** O símbolo cabe em 25 × 19 mm, com a proporção preservada (react-pdf exige tamanho explícito). */
function tamanhoDoSimbolo(img: { largura: number; altura: number }) {
  const proporcao = img.largura / img.altura;
  const altura = Math.min(CABECALHO.alturaDoLogo, CABECALHO.colunaDoLogo / proporcao);
  return { width: altura * proporcao, height: altura };
}

function CabecalhoCompleto({ ctx, s }: { ctx: ContextoDaMarca; s: Estilos }) {
  const linhasDireita = [...ctx.contatos, ctx.cidadeUf].filter((x): x is string => Boolean(x));
  return (
    <View style={s.cabecalhoInterno}>
      <View style={s.linhaDoCabecalho}>
        {ctx.simbolo ? (
          <View style={s.colunaDoLogo}>
            <Image style={tamanhoDoSimbolo(ctx.simbolo)} src={{ data: ctx.simbolo.data, format: ctx.simbolo.format }} />
          </View>
        ) : null}
        <View style={s.wordmark}>
          <Text style={s.nomeDaMarca}>{ctx.nomeDaMarca}</Text>
          {ctx.descritor ? <Text style={s.descritor}>{ctx.descritor.toUpperCase()}</Text> : null}
        </View>
        <View style={s.contatos}>
          {ctx.site ? <Text style={s.contatoForte}>{ctx.site.exibir}</Text> : null}
          {linhasDireita.map((l) => (
            <Text key={l} style={s.contato}>
              {l}
            </Text>
          ))}
        </View>
      </View>
      <View style={s.filete} />
    </View>
  );
}

function CabecalhoCompacto({ ctx, s }: { ctx: ContextoDaMarca; s: Estilos }) {
  const icone = ctx.favicon ?? ctx.simbolo;
  return (
    <View style={s.cabecalhoInterno}>
      <View style={s.linhaCompacta}>
        {icone ? <Image style={s.favicon} src={{ data: icone.data, format: icone.format }} /> : null}
        <Text style={s.nomeCompacto}>{ctx.nomeDaMarca}</Text>
        {ctx.descritor ? <Text style={s.descritorCompacto}>{ctx.descritor.toUpperCase()}</Text> : null}
      </View>
      <View style={s.fileteCompacto} />
    </View>
  );
}

function Rodape({ ctx, s }: { ctx: ContextoDaMarca; s: Estilos }) {
  const esquerda = [ctx.cnpj ? `CNPJ ${ctx.cnpj}` : null, ctx.responsavel].filter((x): x is string => Boolean(x));
  const direita = [ctx.enderecoLinha, ctx.cidadeUfCep].filter((x): x is string => Boolean(x));
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
        <Text style={s.rodapeTextoDir} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    </View>
  );
}

/**
 * Espaço reservado na página 1 para o cabeçalho completo (que é absoluto):
 * da margem de 30 mm até logo abaixo do filete.
 */
const ESPACO_DO_CABECALHO_COMPLETO = PAGINA.cabecalhoTopo + CABECALHO.alturaDoLogo + CABECALHO.distanciaDoFilete + CABECALHO.filete - PAGINA.margemTopo;

export function DocumentoPdf({ doc, contexto }: { doc: DocumentoTimbrado; contexto: ContextoDaMarca }) {
  registrarFontes();
  const cores = doc.pretoEBranco ? paraPretoEBranco(contexto.cores) : contexto.cores;
  const s = estilos(cores);
  const corpo = estilosDoCorpo(cores);
  const metadados = (doc.metadados ?? []).filter((m): m is [string, string] => Boolean(m[1] && m[1].trim()));
  const fixos = (doc.avisos ?? []).filter((a) => a.emTodasAsPaginas);
  const marcaDagua = !doc.semMarcaDagua && !doc.pretoEBranco && contexto.marcaDaguaPermitida ? contexto.simbolo : null;
  const eyebrow = `${doc.tipo}${doc.numero ? ` · Nº ${doc.numero}` : ""}`.toUpperCase();

  return (
    <Document
      title={`${doc.titulo} — ${contexto.nomeDaMarca}`}
      author={contexto.razaoSocial}
      subject={doc.tipo}
      creator={contexto.nomeDaMarca}
      producer={`${contexto.nomeDaMarca} · layout ${VERSAO_DO_LAYOUT}`}
      language="pt-BR"
      creationDate={doc.emitidoEm}
      modificationDate={doc.emitidoEm}
    >
      <Page size={PAGINA.tamanho} style={s.pagina}>
        {/* Marca d'água primeiro: desenhada por trás do texto, só na página 1 (não é `fixed`). */}
        {marcaDagua ? <Image style={s.marcaDagua} src={{ data: marcaDagua.data, format: marcaDagua.format }} /> : null}
        <Faixa s={s} />
        <View
          fixed
          style={s.cabecalho}
          render={({ pageNumber }) => (pageNumber === 1 ? <CabecalhoCompleto ctx={contexto} s={s} /> : <CabecalhoCompacto ctx={contexto} s={s} />)}
        />

        <View style={{ height: ESPACO_DO_CABECALHO_COMPLETO }} />
        <Text style={s.eyebrow}>{eyebrow}</Text>
        <Text style={s.titulo}>{doc.titulo}</Text>
        {metadados.length ? (
          <View style={s.meta} wrap={false}>
            {metadados.map(([rotulo, valor], i) => (
              <View key={rotulo} style={i < metadados.length - 1 ? [s.metaLinha, s.metaDivisoria] : s.metaLinha}>
                <Text style={s.metaRotulo}>{rotulo.toUpperCase()}</Text>
                <Text style={s.metaValor}>{valor}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {(doc.avisos ?? []).map((a) => (
          <CaixaDeAviso key={a.texto} estado={a.estado} texto={a.texto} />
        ))}

        {(doc.corpo.content ?? []).map((n, i) => (
          <Bloco key={`b${i}`} no={n} s={corpo} chave={`b${i}`} />
        ))}

        {doc.assinatura ? (
          <View style={s.assinatura} wrap={false}>
            <Text style={s.fecho}>{doc.assinatura.fecho ?? "Atenciosamente,"}</Text>
            <View style={s.linhaDaAssinatura} />
            <Text style={s.nomeDaAssinatura}>{doc.assinatura.nome}</Text>
            {doc.assinatura.cargo ? <Text style={s.cargo}>{doc.assinatura.cargo}</Text> : null}
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
  return renderToBuffer(<DocumentoPdf doc={doc} contexto={contexto} />);
}
