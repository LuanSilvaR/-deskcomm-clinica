/**
 * POST /api/v1/clinic/financeiro/parcelas/[id]/receber — FORK clinic
 * (financeiro FN2): baixa manual de uma parcela (recebida hoje). O cron
 * `fin-parcelas` já baixa no vencimento; esta é para quem recebe antes ou
 * confere pelo extrato. `financeiro.lancar`.
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
  const authz = await requirePermission("financeiro.lancar", { requestId, resource: "clinic_fin_parcelas" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_fin_receber_parcela", { p_org: authz.org.orgId, p_parcela: id });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.fin_parcela_recebida",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_fin_parcela",
    resourceId: id,
    requestId,
    metadata: {},
  });
  return ok(data, { requestId });
}
