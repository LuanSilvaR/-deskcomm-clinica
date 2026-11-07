/**
 * FORK clinic (orçamento O2, migration 8007) — o orçamento em rascunho.
 *
 * O banco é a autoridade: preço de cada item vem da vigência atual da tabela
 * de preços e os totais/parcelas são calculados em `fn_clinic_orcamento_salvar`
 * e `fn_clinic_orcamento_condicao`. Este arquivo só ESPELHA a conta para a tela
 * mostrar a prévia antes de salvar, e define o que a rota aceita. Sem texto
 * clínico.
 */
import { z } from "zod";

export const FORMAS_DE_PAGAMENTO = ["dinheiro", "pix", "debito", "credito", "parcelado"] as const;
export type FormaDePagamento = (typeof FORMAS_DE_PAGAMENTO)[number];
export const FORMAS_DA_ENTRADA = ["dinheiro", "pix", "debito"] as const;
export type FormaDaEntrada = (typeof FORMAS_DA_ENTRADA)[number];
export const MAX_PARCELAS = 24;

export const ROTULO_DA_FORMA: Record<FormaDePagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Cartão de débito",
  credito: "Cartão de crédito (à vista)",
  parcelado: "Cartão de crédito parcelado",
};

export const STATUS_DO_ORCAMENTO = [
  "rascunho",
  "enviado",
  "aprovado",
  "recusado",
  "expirado",
  "cancelado",
  "substituido",
] as const;
export type StatusDoOrcamento = (typeof STATUS_DO_ORCAMENTO)[number];
export const ROTULO_DO_STATUS_DO_ORCAMENTO: Record<StatusDoOrcamento, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  cancelado: "Cancelado",
  substituido: "Substituído",
};

export interface CondicaoDePagamento {
  forma: FormaDePagamento;
  parcelas: number;
  entrada?: { valor_cents: number; forma: FormaDaEntrada };
  observacao?: string;
}

export interface CondicaoCalculada extends CondicaoDePagamento {
  valor_parcela_cents: number;
  primeira_parcela_cents: number;
}

export class ErroDaCondicao extends Error {}

/**
 * A mesma regra de `fn_clinic_orcamento_condicao`: à vista = 1 parcela, sem
 * entrada; parcelado = 2–24×, entrada opcional (dinheiro/Pix/débito) menor que
 * o total. O centavo que sobra da divisão vai na 1ª parcela.
 */
export function calcularCondicao(c: CondicaoDePagamento, totalCents: number): CondicaoCalculada {
  const entrada = c.entrada?.valor_cents ?? 0;
  if (c.forma === "parcelado") {
    if (!Number.isInteger(c.parcelas) || c.parcelas < 2 || c.parcelas > MAX_PARCELAS) {
      throw new ErroDaCondicao("Parcelado é de 2 a 24 vezes.");
    }
    if (entrada < 0 || (entrada > 0 && entrada >= totalCents)) {
      throw new ErroDaCondicao("A entrada precisa ser menor que o total.");
    }
  } else if (c.parcelas !== 1 || entrada !== 0) {
    throw new ErroDaCondicao("Pagamento à vista não tem parcelas nem entrada.");
  }
  const resto = totalCents - entrada;
  const parcela = Math.floor(resto / c.parcelas);
  const calculada: CondicaoCalculada = {
    forma: c.forma,
    parcelas: c.parcelas,
    valor_parcela_cents: parcela,
    primeira_parcela_cents: parcela + (resto - parcela * c.parcelas),
  };
  if (entrada > 0 && c.entrada) calculada.entrada = c.entrada;
  if (c.observacao) calculada.observacao = c.observacao;
  return calculada;
}

/** Desconto em % do subtotal (0 quando não há subtotal). */
export function percentualDoDesconto(descontoCents: number, subtotalCents: number): number {
  return subtotalCents > 0 ? (descontoCents * 100) / subtotalCents : 0;
}

/** Acima do limite precisa de aprovação (a mesma régua do banco: estritamente maior). */
export function descontoPrecisaAprovar(descontoCents: number, subtotalCents: number, maxPct: number): boolean {
  return descontoCents > 0 && percentualDoDesconto(descontoCents, subtotalCents) > maxPct;
}

// ─── o que a rota aceita ────────────────────────────────────────────────────
const condicaoSchema = z
  .object({
    forma: z.enum(FORMAS_DE_PAGAMENTO),
    parcelas: z.number().int().min(1).max(MAX_PARCELAS).default(1),
    entrada: z
      .object({
        valor_cents: z.number().int().min(1, "Entrada inválida."),
        forma: z.enum(FORMAS_DA_ENTRADA),
      })
      .strict()
      .optional(),
    observacao: z.string().trim().max(200, "Observação do pagamento com até 200 caracteres.").optional(),
  })
  .strict()
  .refine((c) => (c.forma === "parcelado" ? c.parcelas >= 2 : c.parcelas === 1 && !c.entrada), {
    message: "Parcelado é de 2 a 24 vezes; à vista não tem parcelas nem entrada.",
  });

const itemSchema = z
  .object({
    preco_id: z.string().uuid(),
    quantidade: z.number().int().min(1, "Quantidade mínima 1.").max(50, "Quantidade máxima 50.").default(1),
  })
  .strict();

const dadosComuns = {
  atendimento_id: z.string().uuid().nullish(),
  itens: z.array(itemSchema).min(1, "Inclua ao menos um item.").max(50, "Até 50 itens."),
  desconto_cents: z.number().int().min(0, "Desconto inválido.").default(0),
  condicao_pagamento: condicaoSchema,
  validade_ate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Validade inválida.")
    .optional(),
  observacao: z.string().trim().max(500, "Observação com até 500 caracteres.").optional(),
};

/** POST /api/v1/clinic/orcamentos — o paciente vem no corpo; a organização, nunca. */
export const criarOrcamentoSchema = z
  .object({ contact_id: z.string().uuid(), ...dadosComuns })
  .strict();

/** PATCH /api/v1/clinic/orcamentos/[id] — o paciente do orçamento não muda. */
export const editarOrcamentoSchema = z.object(dadosComuns).strict();

export const cancelarOrcamentoSchema = z
  .object({ motivo: z.string().trim().min(3, "Informe o motivo.").max(300, "Motivo com até 300 caracteres.") })
  .strict();

export const COLUNAS_DO_ORCAMENTO =
  "id, contact_id, atendimento_id, profissional_user_id, numero, versao, status, subtotal_cents, desconto_cents, total_cents, desconto_pendente, desconto_aprovado_em, condicao_pagamento, validade_ate, observacao, cancelado_em, motivo_cancelamento, enviado_em, documento_id, aprovado_em, recusado_em, expirado_em, motivo_recusa, substitui_id, created_at, updated_at, clinic_orcamento_itens(id, preco_id, procedure_id, event_type_id, descricao, sessoes, quantidade, preco_unit_cents, total_cents, posicao)";

export interface ItemDoOrcamento {
  id: string;
  preco_id: string;
  procedure_id: string | null;
  event_type_id: string | null;
  descricao: string;
  sessoes: number;
  quantidade: number;
  preco_unit_cents: number;
  total_cents: number;
  posicao: number;
}

export interface Orcamento {
  id: string;
  contact_id: string;
  atendimento_id: string | null;
  profissional_user_id: string | null;
  numero: number;
  versao: number;
  status: StatusDoOrcamento;
  subtotal_cents: number;
  desconto_cents: number;
  total_cents: number;
  desconto_pendente: boolean;
  desconto_aprovado_em: string | null;
  condicao_pagamento: CondicaoCalculada;
  validade_ate: string;
  observacao: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  /** O3 (8008): o contrato emitido e o que aconteceu com ele. */
  enviado_em?: string | null;
  documento_id?: string | null;
  aprovado_em?: string | null;
  recusado_em?: string | null;
  expirado_em?: string | null;
  motivo_recusa?: string | null;
  substitui_id?: string | null;
  created_at: string;
  updated_at: string;
  clinic_orcamento_itens: ItemDoOrcamento[] | null;
}

/** "Nº 12" ou "Nº 12 v2". */
export function rotuloDoNumero(o: Pick<Orcamento, "numero" | "versao">): string {
  return o.versao > 1 ? `Nº ${o.numero} v${o.versao}` : `Nº ${o.numero}`;
}

/** POST /api/v1/clinic/orcamentos/[id]/enviar — só escolhe o modelo; o texto o servidor monta. */
export const enviarOrcamentoSchema = z.object({ modelo_versao_id: z.string().uuid().optional() }).strict();

/** POST /api/v1/clinic/orcamentos/[id]/recusar. */
export const recusarOrcamentoSchema = cancelarOrcamentoSchema;
