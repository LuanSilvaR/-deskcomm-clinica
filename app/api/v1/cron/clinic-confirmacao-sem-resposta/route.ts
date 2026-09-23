/**
 * FORK clinic (migration 9004) — O PACIENTE NÃO RESPONDEU.
 *
 * O lembrete da véspera pediu SIM/NÃO (ver `app/api/v1/cron/agenda-reminder`).
 * Se chegou a 4 h da consulta sem resposta, a recepção recebe uma TAREFA
 * "Ligar para confirmar a consulta" (em `crm_tasks`, com prazo no horário da
 * consulta) e o pedido passa a `sem_resposta`. Uma resposta que chegue depois
 * ainda vale: o SIM fecha a tarefa.
 *
 * A cada 15 min: a janela de 4 h é larga, e o atraso máximo de 15 min não tira
 * o tempo de ligar.
 *
 * Não fala com o paciente e não libera o horário — a decisão é da recepção.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { autorizaCron } from "@/lib/auth/cron-auth";
import { marcarSemResposta } from "@/lib/clinic/confirmacao/servidor";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  if (!autorizaCron(req)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  let resultado: { marcados: number; falhas: number };
  try {
    resultado = await marcarSemResposta(createAdminClient(), new Date());
  } catch (err) {
    logger.error("[clinic-confirmacao-sem-resposta] varredura falhou", {
      error: err instanceof Error ? err.message : String(err),
      requestId,
    });
    return fail("internal_error", "Falha ao varrer confirmações sem resposta.", 500, { requestId });
  }

  // Rodada que não abriu tarefa nenhuma não é mutação e não audita
  // (CLAUDE.md §Audit log; tests/unit/cron-audita-so-quando-ha-efeito.test.ts).
  if (resultado.marcados > 0) {
    await audit({
      action: "clinic.confirmacao_sem_resposta",
      resourceType: "clinic_confirmation_request",
      requestId,
      metadata: resultado,
    });
  }

  return ok(resultado, { requestId });
}

export const GET = handle;
export const POST = handle;
