/**
 * FORK clinic — os TOKENS do papel timbrado. Único lugar com medida, fonte e
 * tamanho de letra de documento (a cor mora em `paleta.ts`).
 *
 * Fonte da verdade visual: `Farias_Rocha_Papel_Timbrado_v2.pdf` (seção 5 da
 * spec em `docs/padrao-documentos.md`). Nenhum tipo de documento sobrescreve
 * nada daqui — e `tests/unit/documentos-sem-hardcode.test.ts` reprova quem
 * tentar declarar estilo fora deste arquivo e de `paleta.ts`.
 *
 * `VERSAO_DO_LAYOUT` sobe a cada mudança visual: documento emitido guarda a
 * versão com que nasceu, e reimprime igual.
 */
export const VERSAO_DO_LAYOUT = 1;

/** 1 mm em pontos tipográficos (a unidade do react-pdf). */
const MM = 72 / 25.4;
export const mm = (valor: number): number => Math.round(valor * MM * 100) / 100;

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

/** Famílias registradas em `fontes.ts`. Cormorant só em tamanho ≥ 18 pt. */
export const FAMILIA = { titulo: "Cormorant Garamond", texto: "Inter" } as const;

export const TIPO = {
  titulo: { fonte: FAMILIA.titulo, peso: 500, tamanho: 30, entrelinha: 1.05, depois: 15 },
  h1: { fonte: FAMILIA.titulo, peso: 500, tamanho: 22, entrelinha: 1.1, antes: 20, depois: 7 },
  h2: { fonte: FAMILIA.titulo, peso: 600, tamanho: 17, entrelinha: 1.1, antes: 16, depois: 6 },
  h3: { fonte: FAMILIA.texto, peso: 700, tamanho: 12, entrelinha: 1.25, antes: 12, depois: 5 },
  corpo: { fonte: FAMILIA.texto, peso: 400, tamanho: 11, entrelinha: 1.45, depois: 8 },
  eyebrow: { fonte: FAMILIA.texto, peso: 700, tamanho: 9, entrelinha: 1.08, espacamento: 1.5, antes: 15 },
  auxiliar: { fonte: FAMILIA.texto, peso: 400, tamanho: 8.5, entrelinha: 1.08 },
  lista: { recuo: mm(9.5), deslocamento: mm(5), marcador: "–" },
} as const;

/** 5.3 — faixa sangrada no topo de toda página. */
export const FAIXA = { primary: mm(3.9), vao: mm(0.6), accent: mm(0.7) } as const;

/** 5.4 — cabeçalho da 1ª página. */
export const CABECALHO = {
  colunaDoLogo: mm(25),
  alturaDoLogo: mm(19),
  wordmark: { tamanho: 26, entrelinha: 15, peso: 600 },
  descritor: { tamanho: 8.5, espacamento: 2, peso: 700 },
  contatos: { tamanho: 9, entrelinha: 1.5 },
  filete: 0.75,
  distanciaDoFilete: 8,
} as const;

/** 5.5 — cabeçalho compacto das páginas 2+. */
export const COMPACTO = {
  favicon: mm(6),
  nome: { tamanho: 15, peso: 600 },
  descritor: { tamanho: 8.5, espacamento: 2, peso: 700 },
  filete: 0.75,
  distanciaDoFilete: 5,
} as const;

/** 5.6 — rodapé de toda página. */
export const RODAPE = {
  colunaEsquerda: mm(113),
  colunaDireita: mm(57),
  tamanho: 8.5,
  entrelinha: 1.35,
  filete: 0.75,
  distanciaDoFilete: 5,
} as const;

/** 5.7 — bloco de abertura. */
export const ABERTURA = {
  colunaDoRotulo: mm(46),
  paddingVertical: 5.5,
  paddingHorizontal: 11,
  divisoria: 0.5,
  rotulo: { tamanho: 8.5, espacamento: 1.2, peso: 700 },
  valor: { tamanho: 10.5 },
  depoisDaTabela: 20,
} as const;

/** 5.8 — fechamento e assinatura. */
export const ASSINATURA = {
  antesDoFecho: 26,
  antesDaLinha: 38,
  larguraDaLinha: mm(64),
  espessura: 0.75,
  cargo: { tamanho: 9.5 },
} as const;

/** 5.9 — marca d'água, só na página 1. */
export const MARCA_DAGUA = {
  largura: mm(80),
  x: mm(112),
  y: mm(166),
  opacidade: 0.075,
  larguraMinimaEmPixels: 600,
} as const;

/** 5.10 — tabelas e avisos do corpo. */
export const TABELA = { cabecalho: { tamanho: 9, peso: 700 }, alturaMinima: mm(7), padding: 4, divisoria: 0.5 } as const;
export const AVISO = { padding: 8, borda: 0.75, tamanho: 10 } as const;
