/**
 * FORK clinic — os TOKENS do papel timbrado. Único lugar com medida, fonte e
 * tamanho de letra de documento (a cor mora em `paleta.ts`).
 *
 * Fonte da verdade: a especificação "Papel timbrado padrão" (layoutVersion
 * 2.0.0, Design System v2.0), transcrita em `docs/padrao-documentos.md`, e o
 * `Farias_Rocha_Papel_Timbrado_v2.pdf` como baseline visual. Nenhum tipo de
 * documento sobrescreve nada daqui — `tests/unit/documentos-sem-hardcode.test.ts`
 * reprova quem tentar declarar estilo fora deste arquivo e de `paleta.ts`.
 *
 * `VERSAO_DO_LAYOUT` sobe a cada mudança visual: documento emitido guarda a
 * versão com que nasceu, e reimprime igual.
 */
export const VERSAO_DO_LAYOUT = "2.0.0";

/** 1 mm em pontos tipográficos (a unidade do react-pdf). */
const MM = 72 / 25.4;
export const mm = (valor: number): number => Math.round(valor * MM * 100) / 100;

/** page */
export const PAGINA = {
  tamanho: "A4" as const,
  largura: mm(210),
  altura: mm(297),
  margemTopo: mm(30),
  margemBase: mm(33),
  margemLateral: mm(20),
  larguraUtil: mm(170),
  cabecalhoTopo: mm(11),
  rodapeBase: mm(9),
};

/** typography.fonts — registradas em `fontes.ts`. Cormorant só em tamanho ≥ 18 pt. */
export const FAMILIA = { titulo: "Cormorant Garamond", texto: "Inter" } as const;

/** typography.styles */
export const TIPO = {
  titulo: { fonte: FAMILIA.titulo, peso: 500, tamanho: 30, entrelinha: 1.05, antes: 0, depois: 15 },
  h1: { fonte: FAMILIA.titulo, peso: 500, tamanho: 22, entrelinha: 1.1, antes: 20, depois: 7 },
  h2: { fonte: FAMILIA.titulo, peso: 600, tamanho: 17, entrelinha: 1.1, antes: 16, depois: 6 },
  h3: { fonte: FAMILIA.texto, peso: 700, tamanho: 12, entrelinha: 1.25, antes: 12, depois: 5 },
  corpo: { fonte: FAMILIA.texto, peso: 400, tamanho: 11, entrelinha: 1.45, antes: 0, depois: 8 },
  eyebrow: { fonte: FAMILIA.texto, peso: 700, tamanho: 9, entrelinha: 1.08, espacamento: 1.5, antes: 15, depois: 3 },
  rodape: { fonte: FAMILIA.texto, peso: 400, tamanho: 8.5, entrelinha: 1.08, depois: 1 },
  lista: { recuo: mm(9.5), deslocamento: mm(5), marcador: "–" },
} as const;

/** topBand — sangrada, ancorada à página, atrás do texto. */
export const FAIXA = { primary: mm(3.9), vao: mm(0.6), accent: mm(0.7) } as const;

/** header.first */
export const CABECALHO = {
  colunas: { logo: mm(25), wordmark: mm(75.8), contatos: mm(69.2) },
  alturaDoLogo: mm(19),
  larguraMaximaDoLogo: mm(25),
  wordmark: { tamanho: 26, entrelinhaExata: 15, peso: 600 },
  descritor: { tamanho: 8.5, espacamento: 2, peso: 700 },
  contatos: { tamanho: 9, entrelinha: 1.45 },
  filete: 0.75,
  antesDoFilete: 8,
} as const;

/** header.compact */
export const COMPACTO = {
  favicon: mm(6),
  nome: { tamanho: 15, peso: 600 },
  descritor: { tamanho: 8.5, espacamento: 2, peso: 700 },
  filete: 0.75,
  antesDoFilete: 5,
} as const;

/** footer */
export const RODAPE = {
  colunas: { esquerda: mm(113), direita: mm(57) },
  filete: 0.75,
  depoisDoFilete: 5,
  maximoDeLinhas: 3,
} as const;

/** openingBlock */
export const ABERTURA = {
  separadorDoEyebrow: "  ·  ",
  colunaDoRotulo: mm(46),
  paddingVertical: 5.5,
  paddingHorizontal: 11,
  divisoria: 0.5,
  rotulo: { tamanho: 8.5, espacamento: 1.2, peso: 700 },
  valor: { tamanho: 10.5 },
  antesDoCorpo: 20,
} as const;

/** signatureBlock */
export const ASSINATURA = {
  fecho: "Atenciosamente,",
  antesDoFecho: 26,
  antesDaLinha: 38,
  depoisDaLinha: 4,
  larguraDaLinha: mm(64),
  espessura: 0.75,
  nome: { tamanho: 11, peso: 700 },
  cargo: { tamanho: 9.5 },
  separador: "  ·  ",
} as const;

/** watermark — em todas as páginas (decisão do dono, 2026-11-09), tingida de `primary`. */
export const MARCA_DAGUA = {
  largura: mm(80),
  x: mm(112),
  y: mm(166),
  opacidade: 0.075,
  larguraMinimaDoLogo: 600,
  larguraMinimaDoFavicon: 512,
} as const;

/** components */
export const TABELA = { cabecalho: { tamanho: 9, peso: 700 }, alturaMinima: mm(7), padding: 4, divisoria: 0.5 } as const;
export const AVISO = { padding: 8, borda: 0.75, tamanho: 9 } as const;
