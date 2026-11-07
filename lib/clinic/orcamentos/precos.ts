/**
 * FORK clinic (orçamento O1, migration 8006) — a tabela de preços.
 *
 * Cada linha de `clinic_precos` é UMA vigência do preço de um item
 * (procedimento OU tipo de serviço × nº de sessões). A tabela só acrescenta:
 * o preço vigente é a vigência mais nova já iniciada, e `ativo = false` tira o
 * item da tabela. Aqui mora a régua em TS (a mesma da view
 * `clinic_precos_vigentes`), para a tela montar a tabela e o histórico de uma
 * leitura só. Sem dado de paciente.
 */
import { z } from "zod";

export interface LinhaDePreco {
  id: string;
  procedure_id: string | null;
  event_type_id: string | null;
  sessoes: number;
  descricao: string | null;
  preco_cents: number;
  ativo: boolean;
  vigente_desde: string;
  created_at: string;
}

export interface ItemDaTabela {
  /** procedimento ou tipo de serviço + sessões: a identidade do item. */
  chave: string;
  /** A linha da vigência atual — o que o orçamento referencia (8007). */
  preco_id: string;
  tipo: "procedimento" | "servico";
  item_id: string;
  sessoes: number;
  descricao: string | null;
  preco_cents: number;
  vigente_desde: string;
  /** Vigências anteriores, da mais nova para a mais velha. */
  historico: Pick<LinhaDePreco, "id" | "preco_cents" | "ativo" | "vigente_desde">[];
}

export const COLUNAS_DO_PRECO =
  "id, procedure_id, event_type_id, sessoes, descricao, preco_cents, ativo, vigente_desde, created_at";

export function chaveDoItem(l: Pick<LinhaDePreco, "procedure_id" | "event_type_id" | "sessoes">): string {
  return l.procedure_id ? `p:${l.procedure_id}:${l.sessoes}` : `s:${l.event_type_id}:${l.sessoes}`;
}

/** Mais nova primeiro: vigência, depois criação, depois id (a mesma ordem da view). */
function maisNovaPrimeiro(a: LinhaDePreco, b: LinhaDePreco): number {
  if (a.vigente_desde !== b.vigente_desde) return a.vigente_desde < b.vigente_desde ? 1 : -1;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Monta a tabela vigente em `agora` (ISO). Vigência futura não vale ainda e
 * não aparece no histórico; item cuja vigência mais nova está inativa sai.
 */
export function tabelaVigente(linhas: readonly LinhaDePreco[], agora: string): ItemDaTabela[] {
  const porItem = new Map<string, LinhaDePreco[]>();
  for (const l of linhas) {
    if (Date.parse(l.vigente_desde) > Date.parse(agora)) continue;
    const k = chaveDoItem(l);
    const lista = porItem.get(k);
    if (lista) lista.push(l);
    else porItem.set(k, [l]);
  }
  const itens: ItemDaTabela[] = [];
  for (const [chave, lista] of porItem) {
    lista.sort(maisNovaPrimeiro);
    const atual = lista[0];
    if (!atual || !atual.ativo) continue;
    itens.push({
      chave,
      preco_id: atual.id,
      tipo: atual.procedure_id ? "procedimento" : "servico",
      item_id: (atual.procedure_id ?? atual.event_type_id) as string,
      sessoes: atual.sessoes,
      descricao: atual.descricao,
      preco_cents: atual.preco_cents,
      vigente_desde: atual.vigente_desde,
      historico: lista.slice(1).map(({ id, preco_cents, ativo, vigente_desde }) => ({ id, preco_cents, ativo, vigente_desde })),
    });
  }
  return itens;
}

/** Preço por sessão de um pacote, em centavos inteiros (arredonda para baixo). */
export function precoPorSessao(item: Pick<ItemDaTabela, "preco_cents" | "sessoes">): number {
  return Math.floor(item.preco_cents / Math.max(1, item.sessoes));
}

/** "R$ 1.500,00" — sempre pt-BR: é a moeda do contrato. */
export function formatarReais(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "150,00" ou "150" → 15000; texto inválido → null. Aceita "1.500,50". */
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/i, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null;
  const [inteiro = "0", fracao = ""] = limpo.replace(/\./g, "").split(",");
  return Number(inteiro) * 100 + Number((fracao + "00").slice(0, 2));
}

export const LIMITE_PRECO_CENTS = 100_000_000;

/** Corpo do POST /api/v1/clinic/precos. O banco confere de novo (CHECK e função). */
export const publicarPrecoSchema = z
  .object({
    procedure_id: z.string().uuid().optional(),
    event_type_id: z.string().uuid().optional(),
    sessoes: z.number().int().min(1, "Mínimo de 1 sessão.").max(100, "Máximo de 100 sessões.").default(1),
    preco_cents: z
      .number()
      .int()
      .min(0, "O preço não pode ser negativo.")
      .max(LIMITE_PRECO_CENTS, "Preço acima do limite."),
    descricao: z.string().trim().max(120, "Descrição com até 120 caracteres.").optional(),
    ativo: z.boolean().default(true),
  })
  .strict()
  .refine((v) => (v.procedure_id ? 1 : 0) + (v.event_type_id ? 1 : 0) === 1, {
    message: "Escolha um procedimento ou um tipo de serviço.",
  });

export type PublicarPreco = z.infer<typeof publicarPrecoSchema>;
