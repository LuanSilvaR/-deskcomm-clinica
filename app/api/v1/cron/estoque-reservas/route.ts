/**
 * FORK clinic (estoque E3, migration 9031) — RESERVA DA VÉSPERA.
 *
 * Agendamentos das próximas 36 h ligados a uma sessão de plano cujo
 * procedimento tem kit reservam o estoque (só nas clínicas com o estoque
 * ligado); reserva de agendamento cancelado, que faltou ou que passou sem
 * atendimento expira. Reserva não é movimento: o saldo não muda, o
 * "disponível" sim. De hora em hora basta: a janela é de 36 h.
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

  const { data, error } = await createAdminClient().rpc("fn_clinic_estoque_reservar_agenda");
  if (error) {
    logger.error("[estoque-reservas] varredura falhou", { error: error.message, requestId });
    return fail("internal_error", "Falha ao reservar o estoque da agenda.", 500, { requestId });
  }
  const resultado = data as { reservadas: number; expiradas: number };

  // Rodada sem efeito não é mutação e não audita (tests/unit/cron-audita-so-quando-ha-efeito.test.ts).
  if (resultado.reservadas + resultado.expiradas > 0) {
    await audit({
      action: "clinic.estoque_reservas_varridas",
      resourceType: "clinic_estoque_reserva",
      requestId,
      metadata: { ...resultado },
    });
  }

  return ok(resultado, { requestId });
}

export const GET = handle;
export const POST = handle;
