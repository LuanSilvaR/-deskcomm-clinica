/**
 * POST /api/v1/clinic/orcamentos/[id]/reprocessar — FORK clinic (orçamento O4,
 * migration 8009): gera o plano de tratamento e a comanda de um orçamento
 * APROVADO quando o pós-aceite automático falhou (`orcamentos.criar`).
 * Idempotente: o que já existe não é criado de novo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoOrcamento } from "@/lib/clinic/orcamentos/erros";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.criar", { requestId, resource: "clinic_orcamentos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("not_found", t("Orçamento não encontrado."), 404, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_orcamento_reprocessar", { p_org: org, p_id: id });
  if (error) {
    const e = erroDoOrcamento(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { plano_id: string; sale_id: string };
  void audit({
    action: "clinic.orcamento_pos_aceite_reprocessado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_orcamento",
    resourceId: id,
    requestId,
    metadata: { plano_id: r.plano_id, sale_id: r.sale_id },
  });
  return ok(r, { requestId });
}
