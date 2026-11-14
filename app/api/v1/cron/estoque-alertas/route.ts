/**
 * FORK clinic (estoque E7, migration 9035) — ALERTAS DO ESTOQUE.
 *
 * De hora em hora, para cada clínica com o estoque ligado: abre o que surgiu
 * (abaixo do mínimo, ponto de pedido, validade em 30/60/90 dias, lote vencido,
 * frasco aberto vencido, pendências da baixa), resolve sozinho o que deixou de
 * valer e não reabre por 7 dias o que alguém dispensou. Sem dado de paciente.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { autorizaCron } from "@/lib/auth/cron-auth";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  if (!autorizaCron(req)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  const { data, error } = await createAdminClient().rpc("fn_clinic_estoque_varrer_alertas");
  if (error) {
    logger.error("[estoque-alertas] varredura falhou", { error: error.message, requestId });
    return fail("internal_error", "Falha ao varrer os alertas do estoque.", 500, { requestId });
  }
  const resultado = data as { abertos: number; resolvidos: number };

  // Rodada sem efeito não é mutação e não audita (tests/unit/cron-audita-so-quando-ha-efeito.test.ts).
  if (resultado.abertos + resultado.resolvidos > 0) {
    await audit({
      action: "clinic.estoque_alertas_varridos",
      resourceType: "clinic_estoque_alerta",
      requestId,
      metadata: { ...resultado },
    });
  }

  return ok(resultado, { requestId });
}

export const GET = handle;
export const POST = handle;
