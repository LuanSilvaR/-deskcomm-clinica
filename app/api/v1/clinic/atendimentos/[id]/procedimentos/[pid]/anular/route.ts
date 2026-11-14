/**
 * POST /api/v1/clinic/atendimentos/:id/procedimentos/:pid/anular — registro
 * errado com o atendimento aberto: fica no histórico como ANULADO, com motivo
 * (FORK clinic, prontuário F5). Nada clínico é apagado.
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

type Ctx = { params: Promise<{ id: string; pid: string }> };

const corpo = z.object({ motivo: z.string().trim().min(3).max(300) }).strict();

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("atendimento.registrar", { requestId, resource: "clinic_procedimentos_realizados" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id, pid } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(pid).success) {
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  }
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Informe o motivo para anular."), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_clinic_procedimento_anular", { p_org: org, p_procedimento: pid, p_motivo: lido.data.motivo });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.procedimento_anulado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_procedimento_realizado",
    resourceId: pid,
    requestId,
    metadata: { atendimento_id: id },
  });
  return ok({ id: pid }, { requestId });
}
