/**
 * POST /api/v1/clinic/atendimentos/:id/reabrir — reabre um atendimento
 * finalizado, com motivo (FORK clinic, prontuário F8). O que já foi finalizado
 * continua imutável; reabrir só permite acrescentar o que faltou.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const corpo = z.object({ motivo: z.string().trim().min(3).max(300) }).strict();

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("atendimento.reabrir", { requestId, resource: "clinic_atendimentos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Informe o motivo."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_clinic_reabrir_atendimento", { p_org: org, p_atendimento: id, p_motivo: lido.data.motivo });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  // O motivo fica no evento clínico (clinic_atendimento_eventos), não no log.
  void audit({
    action: "clinic.atendimento_reaberto",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_atendimento",
    resourceId: id,
    requestId,
    metadata: {},
  });
  return ok({ id }, { requestId });
}
