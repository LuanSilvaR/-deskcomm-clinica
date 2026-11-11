/**
 * FORK clinic (orçamento O3, migration 8008) — EXPIRAÇÃO DOS ORÇAMENTOS.
 *
 * Orçamento enviado cuja validade passou vira "expirado" e o contrato ainda
 * não respondido é cancelado (o link para de valer). Só service role
 * (`fn_clinic_orcamentos_expirar`). De hora em hora basta: a validade é por dia.
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

  const { data, error } = await createAdminClient().rpc("fn_clinic_orcamentos_expirar");
  if (error) {
    logger.error("[orcamentos-expirar] varredura falhou", { error: error.message, requestId });
    return fail("internal_error", "Falha ao expirar os orçamentos.", 500, { requestId });
  }
  const resultado = data as { expirados: number };

  // Rodada sem efeito não é mutação e não audita (tests/unit/cron-audita-so-quando-ha-efeito.test.ts).
  if (resultado.expirados > 0) {
    await audit({
      action: "clinic.orcamentos_expirados",
      resourceType: "clinic_orcamento",
      requestId,
      metadata: { ...resultado },
    });
  }

  return ok(resultado, { requestId });
}

export const GET = handle;
export const POST = handle;
