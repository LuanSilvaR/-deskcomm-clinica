/**
 * FORK clinic (financeiro FN1) — o que as rotas do financeiro aceitam (zod,
 * `.strict()`: campo a mais é recusado; organização nunca vem do corpo).
 */
import { z } from "zod";

import { BANDEIRAS, MAX_PARCELAS, MODALIDADES } from "./taxas";

const dias = z.number().int().min(0).max(400);
const percentual = z.number().min(0).max(100).multipleOf(0.0001);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const adquirenteSchema = z
  .object({
    nome: z.string().trim().min(1).max(80),
    modelo: z.enum(["ton", "cielo_smart", "mercado_pago"]).nullable().optional(),
    prazo_pix_dias: dias.optional(),
    prazo_debito_dias: dias.optional(),
    prazo_credito_dias: dias.optional(),
    tarifa_fixa_cents: z.number().int().min(0).max(100000).optional(),
    antecipacao_pct: percentual.optional(),
    antecipacao_modo: z.enum(["por_mes", "fixa"]).optional(),
    ativo: z.boolean().optional(),
  })
  .strict();

export const adquirenteAlterarSchema = adquirenteSchema.omit({ modelo: true }).partial().strict();

export const linhaDeTaxaSchema = z
  .object({
    bandeira: z.enum(BANDEIRAS).nullable(),
    modalidade: z.enum(MODALIDADES),
    parcelas_de: z.number().int().min(1).max(MAX_PARCELAS),
    parcelas_ate: z.number().int().min(1).max(MAX_PARCELAS),
    mdr_pct: percentual,
  })
  .strict()
  .refine((l) => l.parcelas_ate >= l.parcelas_de, { message: "Faixa de parcelas invertida." })
  .refine((l) => l.modalidade === "credito" || (l.parcelas_de === 1 && l.parcelas_ate === 1), {
    message: "Débito e Pix são sempre 1x.",
  });

export const tabelaSchema = z
  .object({
    vigente_desde: data,
    linhas: z.array(linhaDeTaxaSchema).min(1).max(200),
  })
  .strict();

export const TIPOS_DE_FORMA = ["dinheiro", "pix", "debito", "credito", "boleto", "transferencia", "outro"] as const;

export const formaSchema = z
  .object({
    tipo: z.enum(TIPOS_DE_FORMA),
    adquirente_id: z.string().uuid().nullable(),
  })
  .strict()
  .refine((f) => f.adquirente_id === null || ["pix", "debito", "credito"].includes(f.tipo), {
    message: "Só Pix, débito e crédito passam pela maquininha.",
  });

export const simularSchema = z
  .object({
    adquirente_id: z.string().uuid(),
    modalidade: z.enum(MODALIDADES),
    bandeira: z.enum(BANDEIRAS).nullable().default(null),
    parcelas: z.number().int().min(1).max(MAX_PARCELAS),
    bruto_cents: z.number().int().min(1).max(100_000_000_00),
    data: data.optional(),
    antecipar: z.boolean().default(false),
    /** opcional: custo direto (insumos + comissão) para o alerta de margem e o preço sugerido */
    custo_cents: z.number().int().min(0).max(100_000_000_00).optional(),
    margem_pct: z.number().min(0).max(95).optional(),
  })
  .strict();

// ─── FN2: fechamento com taxas, recebíveis e configuração ───────────────────

export const pagamentoDaComandaSchema = z
  .object({
    payment_method_id: z.string().uuid(),
    valor_cents: z.number().int().min(1).max(100_000_000_00),
    parcelas: z.number().int().min(1).max(MAX_PARCELAS).default(1),
    bandeira: z.enum(BANDEIRAS).nullable().default(null),
  })
  .strict();

export const finalizarComTaxasSchema = z
  .object({
    pagamentos: z.array(pagamentoDaComandaSchema).min(1).max(6),
    loyalty_points: z.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const estornarComTaxasSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

export const configFinanceiroSchema = z
  .object({
    comissao_base: z.enum(["liquido", "bruto"]).optional(),
    margem_minima_pct: z.number().min(0).max(95).optional(),
  })
  .strict()
  .refine((v) => v.comissao_base !== undefined || v.margem_minima_pct !== undefined, {
    message: "Nada para salvar.",
  });

export const STATUS_DE_PARCELA = ["prevista", "recebida", "antecipada", "estornada"] as const;
