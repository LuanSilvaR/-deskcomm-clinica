/**
 * FORK clinic (estoque E0) — o que as rotas de estoque aceitam.
 *
 * Quantidades na UNIDADE DE APLICAÇÃO do produto (U, mL, un…), salvo
 * `em_unidade_estoque` na entrada. O banco confere tudo de novo (permissão,
 * empresa, lote vencido, saldo); aqui só formato e limites.
 */
import { z } from "zod";

const uuid = z.string().uuid();
const quantidade = z.number().positive().max(10_000_000);
const motivo = z.string().trim().min(3).max(300);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const CONSELHOS = ["CRM", "CRO", "COREN", "CRBM", "CFF", "CREFITO", "outro"] as const;
export const TIPOS_DE_LOCAL = ["central", "sala", "carrinho", "farmacia", "outro"] as const;

export const produtoEstoqueSchema = z
  .object({
    ean: z
      .string()
      .trim()
      .regex(/^\d{8,14}$/)
      .nullish()
      .or(z.literal("")),
    ncm: z
      .string()
      .trim()
      .regex(/^\d{8}$/)
      .nullish()
      .or(z.literal("")),
    registro_anvisa: z.string().trim().max(40).nullish(),
    unidade_estoque: z.string().trim().min(1).max(20),
    unidade_aplicacao: z.string().trim().min(1).max(20),
    fator_conversao: z.number().positive().max(1_000_000),
    fracionavel: z.boolean(),
    validade_pos_abertura_horas: z.number().int().min(1).max(8760).nullish(),
    rastreado: z.boolean(),
    controlado: z.boolean(),
    conselhos_permitidos: z.array(z.enum(CONSELHOS)).max(CONSELHOS.length),
    estoque_minimo: z.number().min(0).max(10_000_000),
    ponto_pedido: z.number().min(0).max(10_000_000).nullish(),
    gerenciado: z.boolean(),
    versao: z.number().int().min(1).nullish(),
  })
  .strict();

export const localSchema = z
  .object({
    nome: z.string().trim().min(1).max(80),
    tipo: z.enum(TIPOS_DE_LOCAL),
    resource_id: uuid.nullish(),
    padrao: z.boolean().optional(),
    ativo: z.boolean().optional(),
  })
  .strict();

export const movimentoSchema = z.discriminatedUnion("acao", [
  z
    .object({
      acao: z.literal("entrada"),
      product_id: uuid,
      local_id: uuid,
      quantidade,
      em_unidade_estoque: z.boolean().optional(),
      lote: z.string().trim().max(60).nullish(),
      validade: data.nullish(),
      custo_unitario_cents: z.number().min(0).max(1_000_000_000).nullish(),
      motivo: z.string().trim().max(300).nullish(),
    })
    .strict(),
  z
    .object({
      acao: z.literal("transferencia"),
      lote_id: uuid,
      origem_id: uuid,
      destino_id: uuid,
      quantidade,
      motivo: z.string().trim().max(300).nullish(),
    })
    .strict(),
  z
    .object({ acao: z.literal("perda"), lote_id: uuid, local_id: uuid, quantidade, motivo })
    .strict(),
  z
    .object({
      acao: z.literal("ajuste"),
      lote_id: uuid,
      local_id: uuid,
      saldo_correto: z.number().min(0).max(10_000_000),
      motivo,
    })
    .strict(),
]);
export type Movimento = z.infer<typeof movimentoSchema>;

/** Ação da tela → função do banco e permissão exigida (a rota pede a mesma). */
export const FUNCAO_DO_MOVIMENTO: Record<Movimento["acao"], { rpc: string; permissao: string }> = {
  entrada: { rpc: "fn_clinic_estoque_entrada", permissao: "estoque.movimentar" },
  transferencia: { rpc: "fn_clinic_estoque_transferir", permissao: "estoque.movimentar" },
  perda: { rpc: "fn_clinic_estoque_perda", permissao: "estoque.movimentar" },
  ajuste: { rpc: "fn_clinic_estoque_ajustar", permissao: "estoque.inventariar" },
};

export const estornoSchema = z.object({ motivo }).strict();

/** Resolver uma pendência da baixa pelo prontuário (estoque E2). */
export const pendenciaSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("baixar"), lote_id: uuid, local_id: uuid }).strict(),
  z.object({ acao: z.literal("descartar"), motivo }).strict(),
  z.object({ acao: z.literal("ciente"), motivo }).strict(),
]);
export type ResolucaoDePendencia = z.infer<typeof pendenciaSchema>;

/** O kit de um procedimento (estoque E3): substitui a lista inteira. */
export const kitSchema = z
  .object({
    itens: z
      .array(z.object({ product_id: uuid, quantidade }).strict())
      .max(50)
      .refine((l) => new Set(l.map((i) => i.product_id)).size === l.length, "produto repetido"),
  })
  .strict();

/** Abrir um frasco (estoque E4) e encerrá-lo (a sobra vira perda). */
export const abrirFrascoSchema = z.object({ lote_id: uuid, local_id: uuid }).strict();
export const encerrarFrascoSchema = z.object({ motivo }).strict();
