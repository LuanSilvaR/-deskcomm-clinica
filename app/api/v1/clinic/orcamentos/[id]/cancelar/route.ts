/**
 * POST /api/v1/clinic/orcamentos/[id]/cancelar — FORK clinic (orçamento O2):
 * cancela o rascunho com motivo (`orcamentos.cancelar`). Nada se apaga.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoOrcamento } from "@/lib/clinic/orcamentos/erros";
import { orcamentoNoEscopo } from "@/lib/clinic/orcamentos/escopo";
import { cancelarOrcamentoSchema } from "@/lib/clinic/orcamentos/orcamento";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.cancelar", { requestId, resource: "clinic_orcamentos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("not_found", t("Orçamento não encontrado."), 404, { requestId });
  const lido = cancelarOrcamentoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Informe o motivo."), 422, { requestId });
  }
  const org = authz.org.orgId;
  const supabase = await createClient();
  // FORK clinic (O5, revisão security-lgpd): só pacientes do escopo de quem pede.
  if (!(await orcamentoNoEscopo(supabase, org, authz.user.id, id))) {
    return fail("not_found", t("Orçamento não encontrado."), 404, { requestId });
  }
  const { error } = await supabase.rpc("fn_clinic_orcamento_cancelar", { p_org: org, p_id: id, p_motivo: lido.data.motivo });
  if (error) {
    const e = erroDoOrcamento(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  // O motivo NÃO vai para a auditoria: é texto livre e pode carregar dado do paciente.
  void audit({
    action: "clinic.orcamento_cancelado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_orcamento",
    resourceId: id,
    requestId,
  });
  return ok({ id }, { requestId });
}
