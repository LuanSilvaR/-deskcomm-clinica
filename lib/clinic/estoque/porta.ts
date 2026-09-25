/**
 * FORK clinic (prontuário F5) — a PORTA de estoque.
 *
 * O prontuário registra o que foi gasto em cada procedimento (produto,
 * quantidade, lote, validade) e, ao finalizar, publica
 * `clinic.procedimento_confirmado` em `event_log` (migration 9022). Quem
 * transforma isso em movimento de estoque é uma implementação desta porta.
 * Hoje não existe estoque por movimentos (regra do repo: estoque = soma de
 * movimentos), então a implementação é `SemEstoque`: não mexe em nada e diz
 * que não mexeu. O módulo de estoque futuro entra aqui, sem tocar no
 * prontuário, e grava de volta o `movimento_estoque_id` de cada insumo.
 */
import { z } from "zod";

export const insumoConfirmadoSchema = z.object({
  insumo_id: z.string().uuid(),
  product_id: z.string().uuid().nullable(),
  quantidade: z.coerce.number().positive(),
  unidade: z.string(),
  lote: z.string().nullable(),
  validade: z.string().nullable(),
});
export type InsumoConfirmado = z.infer<typeof insumoConfirmadoSchema>;

export const procedimentoConfirmadoSchema = z.object({
  atendimento_id: z.string().uuid(),
  procedure_id: z.string().uuid().nullable(),
  event_type_id: z.string().uuid().nullable(),
  insumos: z.array(insumoConfirmadoSchema),
});
export type ProcedimentoConfirmado = z.infer<typeof procedimentoConfirmadoSchema>;

export interface ResultadoDoConsumo {
  /** Movimentos gravados, por insumo. Vazio quando não há estoque. */
  movimentos: Array<{ insumo_id: string; movimento_estoque_id: string }>;
  /** Por que nada foi baixado (ex.: "sem_estoque"). */
  motivo?: string;
}

export interface PortaDeEstoque {
  registrarConsumo(organizationId: string, procedimento: ProcedimentoConfirmado): Promise<ResultadoDoConsumo>;
}

/** Nenhum módulo de estoque instalado: registra nada, explicitamente. */
export const SemEstoque: PortaDeEstoque = {
  async registrarConsumo() {
    return { movimentos: [], motivo: "sem_estoque" };
  },
};

/** A porta em uso. Trocar por uma implementação real é mudar esta linha. */
export function portaDeEstoque(): PortaDeEstoque {
  return SemEstoque;
}
