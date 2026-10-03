/**
 * FORK clinic (prontuário F5) — a PORTA de estoque.
 *
 * O prontuário registra o que foi gasto em cada procedimento (produto,
 * quantidade, lote, validade) e, ao finalizar, publica
 * `clinic.procedimento_confirmado` em `event_log` (migration 9022). Quem
 * transforma isso em movimento de estoque é uma implementação desta porta.
 * `SemEstoque` não mexe em nada e diz que não mexeu. `EstoqueReal` (estoque
 * E2, migration 9030) chama `fn_clinic_estoque_baixar_procedimento` pelo
 * service role: a função lê os insumos DO BANCO (o payload só diz qual
 * procedimento), grava a saída por lote/local e o `movimento_estoque_id` de
 * cada insumo, ou abre pendência. Com a opção desligada, não baixa nada.
 */
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

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
  /** Movimentos a gravar no insumo, por insumo. Vazio quando não há estoque. */
  movimentos: Array<{ insumo_id: string; movimento_estoque_id: string }>;
  /** Por que nada foi baixado (ex.: "sem_estoque"). */
  motivo?: string;
  /** A própria porta já gravou tudo (insumos ligados às operações): resumo. */
  concluido?: string;
}

export interface ContextoDoConsumo {
  /** O procedimento realizado (entity_id do evento — fonte confiável). */
  procedimentoId: string | null;
}

export interface PortaDeEstoque {
  registrarConsumo(
    organizationId: string,
    procedimento: ProcedimentoConfirmado,
    contexto?: ContextoDoConsumo,
  ): Promise<ResultadoDoConsumo>;
}

/** Nenhum módulo de estoque instalado: registra nada, explicitamente. */
export const SemEstoque: PortaDeEstoque = {
  async registrarConsumo() {
    return { movimentos: [], motivo: "sem_estoque" };
  },
};

const resumoSchema = z.object({
  ligado: z.boolean(),
  baixados: z.number().optional(),
  pendencias: z.number().optional(),
  livres: z.number().optional(),
});

/** O estoque da clínica (E2). Erro do banco sobe: o dreno tenta de novo. */
export const EstoqueReal: PortaDeEstoque = {
  async registrarConsumo(organizationId, _procedimento, contexto) {
    if (!contexto?.procedimentoId) return { movimentos: [], motivo: "sem_procedimento" };
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("fn_clinic_estoque_baixar_procedimento", {
      p_org: organizationId,
      p_procedimento: contexto.procedimentoId,
    });
    if (error) throw new Error(error.message);
    const r = resumoSchema.safeParse(data);
    if (!r.success) throw new Error("resposta inesperada da baixa de estoque");
    if (!r.data.ligado) return { movimentos: [], motivo: "estoque_desligado" };
    const { baixados = 0, pendencias = 0, livres = 0 } = r.data;
    if (baixados === 0 && pendencias === 0) {
      return { movimentos: [], motivo: livres > 0 ? "consumo_livre" : "nada a baixar" };
    }
    return { movimentos: [], concluido: `${baixados} baixa(s), ${pendencias} pendência(s)` };
  },
};

/** A porta em uso: o estoque real (ele mesmo respeita a opção da empresa). */
export function portaDeEstoque(): PortaDeEstoque {
  return EstoqueReal;
}
