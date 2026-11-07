/**
 * POST /api/v1/clinic/orcamentos/[id]/recusar — FORK clinic (orçamento O3):
 * o paciente recusou o orçamento enviado (`orcamentos.criar`). O contrato
 * ainda não respondido é cancelado junto. Nada se apaga.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoOrcamento } from "@/lib/clinic/orcamentos/erros";
import { recusarOrcamentoSchema } from "@/lib/clinic/orcamentos/orcamento";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.criar", { requestId, resource: "clinic_orcamentos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("not_found", t("Orçamento não encontrado."), 404, { requestId });
  const lido = recusarOrcamentoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Informe o motivo."), 422, { requestId });
  }
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_clinic_orcamento_recusar", { p_org: org, p_id: id, p_motivo: lido.data.motivo });
  if (error) {
    const e = erroDoOrcamento(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  // O motivo NÃO vai para a auditoria: é texto livre e pode carregar dado do paciente.
  void audit({
    action: "clinic.orcamento_recusado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_orcamento",
    resourceId: id,
    requestId,
  });
  return ok({ id }, { requestId });
}
