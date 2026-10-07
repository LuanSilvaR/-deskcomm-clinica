/**
 * FORK clinic (financeiro FN2, migration 9040) — BAIXA DAS PARCELAS VENCIDAS.
 *
 * Uma vez por dia (06:10): toda parcela de cartão/Pix cujo vencimento chegou no
 * fuso da clínica vira recebida — a adquirente deposita sozinha, e a conta a
 * receber e a taxa da parcela passam a pagas na data do depósito. A baixa
 * manual continua existindo para quem recebe antes (ou confere o extrato).
 * Sem dado de paciente.
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

  const { data, error } = await createAdminClient().rpc("fn_clinic_fin_baixar_vencidas");
  if (error) {
    logger.error("[fin-parcelas] baixa falhou", { error: error.message, requestId });
    return fail("internal_error", "Falha ao baixar as parcelas vencidas.", 500, { requestId });
  }
  const baixadas = Number(data ?? 0);

  // Rodada sem efeito não é mutação e não audita (tests/unit/cron-audita-so-quando-ha-efeito.test.ts).
  if (baixadas > 0) {
    await audit({
      action: "clinic.fin_parcelas_baixadas",
      resourceType: "clinic_fin_parcela",
      requestId,
      metadata: { baixadas },
    });
  }

  return ok({ baixadas }, { requestId });
}

export const GET = handle;
export const POST = handle;
