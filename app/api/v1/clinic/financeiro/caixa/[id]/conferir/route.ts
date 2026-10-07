/**
 * POST /api/v1/clinic/financeiro/caixa/[id]/conferir — FORK clinic
 * (financeiro FN3): a DUPLA CONFERÊNCIA. Outra pessoa (não quem fechou), com
 * `financeiro.conferir`, confirma o fechamento; a diferença vira lançamento.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoFinanceiro } from "@/lib/clinic/financeiro/erros";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.conferir", { requestId, resource: "clinic_fin_caixas" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_fin_caixa_conferir", { p_org: authz.org.orgId, p_caixa: id });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.fin_caixa_conferido",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_fin_caixa",
    resourceId: id,
    requestId,
    metadata: { diferenca_cents: (data as { diferenca_cents: number }).diferenca_cents },
  });
  return ok(data, { requestId });
}
