/**
 * POST /api/v1/clinic/atendimentos/:id/finalizar — "Finalizar atendimento".
 *
 * Leva a visita a `finalizado` (e o núcleo a "Compareceu", pelo mesmo caminho
 * da recepção) e encerra o atendimento (`fn_clinic_finalizar_atendimento`).
 * Repetir é seguro. Os requisitos por seção (anamnese, evolução...) entram
 * quando as seções existirem (fases F2/F3 do plano).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { ApiError } from "@/lib/api/types";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { finalizarAtendimento } from "@/lib/clinic/atendimento/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("atendimento.finalizar", { requestId, resource: "clinic_atendimentos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const org = authz.org.orgId;

  try {
    const r = await finalizarAtendimento(
      await createClient(),
      { organization_id: org, actor: { type: "user", id: authz.user.id }, requestId },
      { atendimentoId: id },
    );
    if (r.mudou) {
      void audit({
        action: "clinic.atendimento_finalizado",
        actorUserId: authz.user.id,
        organizationId: org,
        resourceType: "clinic_atendimento",
        resourceId: r.id,
        requestId,
      });
    }
    return ok(r, { requestId });
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, t(err.message), err.status, {
        requestId,
        details: err.details as Record<string, unknown> | undefined,
      });
    }
    throw err;
  }
}
