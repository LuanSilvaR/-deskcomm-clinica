/**
 * FORK clinic (9015) — o que as rotas de procedimentos aceitam. Os limites
 * espelham os CHECKs da migration 9015 (a rota recusa antes, com mensagem).
 */
import { z } from "zod";

const texto = (max: number, obrigatorio: string) => z.string().trim().min(1, obrigatorio).max(max);

export const dadosDoProcedimentoSchema = z
  .object({
    name: texto(120, "Informe o nome."),
    code: z.string().trim().max(30, "Código muito longo.").nullish(),
    short_description: texto(240, "Informe a descrição breve."),
    description: z.string().trim().max(4000, "Descrição muito longa.").nullish(),
    duration_minutes: z.number().int().min(5, "Duração mínima de 5 minutos.").max(600, "Duração máxima de 600 minutos.").nullish(),
    is_active: z.boolean().optional(),
  })
  .strict();

export const vinculosSchema = z
  .object({
    specialty_ids: z.array(z.string().uuid()).max(50),
    professional_ids: z.array(z.string().uuid()).max(200),
  })
  .strict();

export const criarProcedimentoSchema = dadosDoProcedimentoSchema.extend({
  specialty_ids: z.array(z.string().uuid()).max(50).optional(),
  professional_ids: z.array(z.string().uuid()).max(200).optional(),
});

export const alterarProcedimentoSchema = dadosDoProcedimentoSchema.partial().refine((v) => Object.values(v).some((x) => x !== undefined), {
  message: "Nada para alterar.",
});

/** Código vazio vira null (sem código é permitido; repetido não). */
export function codigoOuNulo(code: string | null | undefined): string | null {
  const c = (code ?? "").trim();
  return c ? c : null;
}
