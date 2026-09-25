/**
 * FORK clinic (prontuário F5) — consumidor de `clinic.procedimento_confirmado`.
 *
 * Entrega os insumos do procedimento à porta de estoque (lib/clinic/estoque/
 * porta.ts) e grava de volta o `movimento_estoque_id` de cada insumo que ela
 * devolver. Com `SemEstoque`, só marca o evento como lido ("skipped").
 */
import type { EventHandler, HandlerResult } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";

import { portaDeEstoque, procedimentoConfirmadoSchema } from "./porta";

export const CLINIC_ESTOQUE_HANDLER_KEY = "clinic-estoque-consumo.v1";

export const clinicEstoqueConsumoHandler: EventHandler = {
  key: CLINIC_ESTOQUE_HANDLER_KEY,
  events: ["clinic.procedimento_confirmado"],
  async handle(row): Promise<HandlerResult> {
    const lido = procedimentoConfirmadoSchema.safeParse(row.payload);
    if (!lido.success) {
      return { consumer_key: CLINIC_ESTOQUE_HANDLER_KEY, status: "skipped", detail: "payload inválido" };
    }
    const r = await portaDeEstoque().registrarConsumo(row.organization_id, lido.data);
    if (r.movimentos.length === 0) {
      return { consumer_key: CLINIC_ESTOQUE_HANDLER_KEY, status: "skipped", detail: r.motivo ?? "nada a baixar" };
    }
    const admin = createAdminClient();
    for (const m of r.movimentos) {
      // Organização do EVENTO (fonte confiável), nunca do payload.
      const { error } = await admin
        .from("clinic_procedimento_insumos")
        .update({ movimento_estoque_id: m.movimento_estoque_id } as never)
        .eq("organization_id", row.organization_id)
        .eq("id", m.insumo_id);
      if (error) return { consumer_key: CLINIC_ESTOQUE_HANDLER_KEY, status: "error", detail: error.message };
    }
    return { consumer_key: CLINIC_ESTOQUE_HANDLER_KEY, status: "ok", detail: `${r.movimentos.length} movimento(s)` };
  },
};
