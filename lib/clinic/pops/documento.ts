/**
 * FORK clinic (9015) — o documento do POP: o JSON do editor (ProseMirror/Tiptap).
 *
 * Nada de HTML: o que se grava é uma ÁRVORE de nós de uma lista FECHADA, com
 * marcas de uma lista fechada e sem atributo livre (sem href, sem style, sem
 * classe). Tipo de nó ou marca fora da lista é recusado na rota. ATRIBUTO
 * desconhecido de um nó conhecido é DESCARTADO, não recusado: o Tiptap 3.31
 * passou a pôr `align` em toda célula de tabela, e recusar o documento inteiro
 * por isso fazia nenhum POP com tabela ser salvo (issue #124) — o autosave
 * falhava calado e o texto depois da primeira tabela se perdia. Por isso a tela e o PDF podem
 * renderizar a árvore sem sanitizar HTML — não existe HTML para injetar.
 *
 * Nós: doc, paragraph, heading(1–3), bulletList, orderedList, listItem, table,
 * tableRow, tableHeader, tableCell, hardBreak, horizontalRule, quebraDePagina, text.
 * Marcas: bold, italic, underline.
 */
import { z } from "zod";

/** 5 MB — o mesmo número do CHECK clinic_pop_versions_documento_check (migration 8015). Um POP de 12 mil caracteres ocupa ~25 KB. */
export const LIMITE_DE_BYTES = 5 * 1024 * 1024;
export const LIMITE_DE_NOS = 100_000;
export const LIMITE_DE_PROFUNDIDADE = 12;

export interface NoDoDocumento {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NoDoDocumento[];
  text?: string;
  marks?: { type: string }[];
}

const marca = z.object({ type: z.enum(["bold", "italic", "underline"]) }).strict();

const texto = z
  .object({
    type: z.literal("text"),
    text: z.string().min(1).max(100_000),
    marks: z.array(marca).max(3).optional(),
  })
  .strict();

// Atributos: `z.object` sem `.strict()` DESCARTA as chaves desconhecidas (ver o cabeçalho).
const semAttrs = z.object({}).optional();
const alinhamento = z.object({ textAlign: z.enum(["left", "center", "right", "justify"]).nullish() }).optional();
const celula = z
  .object({
    colspan: z.number().int().min(1).max(20).optional(),
    rowspan: z.number().int().min(1).max(50).optional(),
    colwidth: z.array(z.number().int().min(1).max(2000)).nullish(),
  })
  .optional();

const no: z.ZodType<NoDoDocumento> = z.lazy(() =>
  z.union([
    texto,
    z.object({ type: z.literal("paragraph"), attrs: alinhamento, content: z.array(no).optional() }).strict(),
    z
      .object({
        type: z.literal("heading"),
        attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]), textAlign: z.enum(["left", "center", "right", "justify"]).nullish() }),
        content: z.array(no).optional(),
      })
      .strict(),
    z.object({ type: z.literal("bulletList"), attrs: semAttrs, content: z.array(no).optional() }).strict(),
    z
      .object({
        type: z.literal("orderedList"),
        attrs: z.object({ start: z.number().int().min(0).max(10_000).optional(), type: z.string().max(10).nullish() }).optional(),
        content: z.array(no).optional(),
      })
      .strict(),
    z.object({ type: z.literal("listItem"), attrs: semAttrs, content: z.array(no).optional() }).strict(),
    z.object({ type: z.literal("table"), attrs: semAttrs, content: z.array(no).optional() }).strict(),
    z.object({ type: z.literal("tableRow"), attrs: semAttrs, content: z.array(no).optional() }).strict(),
    z.object({ type: z.literal("tableHeader"), attrs: celula, content: z.array(no).optional() }).strict(),
    z.object({ type: z.literal("tableCell"), attrs: celula, content: z.array(no).optional() }).strict(),
    z.object({ type: z.literal("hardBreak"), marks: z.array(marca).max(3).optional() }).strict(),
    z.object({ type: z.literal("horizontalRule") }).strict(),
    z.object({ type: z.literal("quebraDePagina") }).strict(),
  ]),
);

export const documentoSchema = z
  .object({ type: z.literal("doc"), content: z.array(no).max(50_000) })
  .strict();

export type Documento = z.infer<typeof documentoSchema>;

export const DOCUMENTO_VAZIO: Documento = { type: "doc", content: [{ type: "paragraph" }] };

function medir(n: NoDoDocumento, profundidade: number, acc: { nos: number; fundo: number }): void {
  acc.nos += 1;
  acc.fundo = Math.max(acc.fundo, profundidade);
  for (const f of n.content ?? []) medir(f, profundidade + 1, acc);
}

export type ResultadoDaValidacao = { ok: true; documento: Documento } | { ok: false; motivo: string };

/** Valida o JSON vindo do navegador: forma, tamanho, quantidade de nós e profundidade. */
export function validarDocumento(bruto: unknown): ResultadoDaValidacao {
  let tamanho = 0;
  try {
    tamanho = new TextEncoder().encode(JSON.stringify(bruto)).length;
  } catch {
    return { ok: false, motivo: "Documento inválido." };
  }
  if (tamanho > LIMITE_DE_BYTES) return { ok: false, motivo: "O documento passou do tamanho máximo (5 MB)." };
  const lido = documentoSchema.safeParse(bruto);
  if (!lido.success) return { ok: false, motivo: "O documento tem um elemento que o editor não permite." };
  const acc = { nos: 0, fundo: 0 };
  medir(lido.data as NoDoDocumento, 0, acc);
  if (acc.nos > LIMITE_DE_NOS || acc.fundo > LIMITE_DE_PROFUNDIDADE) return { ok: false, motivo: "O documento é grande demais." };
  return { ok: true, documento: lido.data };
}

/** O texto puro do documento (busca, comparação, extração no PDF de teste). */
export function textoPuro(doc: NoDoDocumento): string {
  const partes: string[] = [];
  const blocos = new Set(["paragraph", "heading", "listItem", "tableRow", "quebraDePagina", "horizontalRule"]);
  const andar = (n: NoDoDocumento) => {
    if (n.type === "text" && n.text) partes.push(n.text);
    if (n.type === "hardBreak") partes.push("\n");
    if (n.type === "tableCell" || n.type === "tableHeader") partes.push(" ");
    for (const f of n.content ?? []) andar(f);
    if (blocos.has(n.type)) partes.push("\n");
  };
  andar(doc);
  return partes.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
