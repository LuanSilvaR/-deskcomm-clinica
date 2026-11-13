import { z } from "zod";

import { INTERVALOS } from "@/lib/cobranca/vocabulario";

/**
 * FORK (card #159; origem upstream `lib/schemas/cobranca-plano.ts`) — o plano de
 * cobrança da plataforma (`cobranca_planos`, migration 8026). Os limites são os
 * mesmos dos CHECKs da tabela, para a recusa sair com nome antes do banco. A
 * régua é a mesma na rota e no formulário de /admin/cobranca. `moeda` não entra:
 * é BRL, fixada pelo default e pelo CHECK.
 *
 * Preço nunca é fixo no código: os planos de referência (Standard, Premium,
 * Combo IA, Agentes IA) são cadastrados pela tela.
 */
const INT4_MAX = 2_147_483_647;

const teto = (minimo: number) => z.number().int().min(minimo).max(INT4_MAX).nullable();

const campos = {
  nome: z.string().trim().min(1).max(60),
  preco_cents: z
    .number()
    .int()
    .min(500, "O preço mínimo é R$ 5,00: abaixo disso o boleto não sai.")
    .max(INT4_MAX),
  intervalo: z.enum(INTERVALOS),
  trial_dias: z.number().int().min(0).max(90),
  max_assentos: teto(1),
  max_canais: teto(1),
  teto_ia_usd_cents: teto(100),
  padrao_no_cadastro: z.boolean(),
  oferecido_ao_cliente: z.boolean(),
};

export const novoPlanoSchema = z.strictObject({
  nome: campos.nome,
  preco_cents: campos.preco_cents,
  intervalo: campos.intervalo,
  trial_dias: campos.trial_dias,
  max_assentos: campos.max_assentos.optional(),
  max_canais: campos.max_canais.optional(),
  teto_ia_usd_cents: campos.teto_ia_usd_cents.optional(),
  padrao_no_cadastro: campos.padrao_no_cadastro.optional(),
  oferecido_ao_cliente: campos.oferecido_ao_cliente.optional(),
});
export type NovoPlano = z.infer<typeof novoPlanoSchema>;

export const edicaoDoPlanoSchema = z
  .strictObject({ ...campos, arquivado: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nada para mudar.");
export type EdicaoDoPlano = z.infer<typeof edicaoDoPlanoSchema>;

/** O `SELECT` do plano inteiro — literal, para o supabase-js tipar o retorno. */
export const COLUNAS_DO_PLANO =
  "id, nome, preco_cents, moeda, intervalo, trial_dias, max_assentos, max_canais, teto_ia_usd_cents, padrao_no_cadastro, oferecido_ao_cliente, arquivado_em, created_at, updated_at";

export interface PlanoDeCobranca {
  id: string;
  nome: string;
  preco_cents: number;
  moeda: string;
  intervalo: (typeof INTERVALOS)[number];
  trial_dias: number;
  max_assentos: number | null;
  max_canais: number | null;
  teto_ia_usd_cents: number | null;
  padrao_no_cadastro: boolean;
  oferecido_ao_cliente: boolean;
  arquivado_em: string | null;
  created_at: string;
  updated_at: string;
}
