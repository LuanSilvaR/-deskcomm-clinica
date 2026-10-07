/**
 * GET/POST /api/v1/clinic/financeiro/pagamentos/[id]/antecipar — FORK clinic
 * (financeiro FN2): GET simula quanto custa antecipar as parcelas a receber do
 * pagamento (`financeiro.ver`); POST antecipa (`financeiro.lancar`): as
 * parcelas viram recebidas hoje e o custo vai como saída `anticipation`.
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

async function antecipar(ctx: Ctx, confirmar: boolean): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission(confirmar ? "financeiro.lancar" : "financeiro.ver", {
    requestId,
    resource: "clinic_fin_pagamentos",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_fin_antecipar", {
    p_org: authz.org.orgId,
    p_pagamento: id,
    p_confirmar: confirmar,
  });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  if (confirmar) {
    const r = data as { parcelas: number; custo_cents: number };
    void audit({
      action: "clinic.fin_antecipacao_feita",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "clinic_fin_pagamento",
      resourceId: id,
      requestId,
      metadata: { parcelas: r.parcelas, custo_cents: r.custo_cents },
    });
  }
  return ok(data, { requestId });
}

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  return antecipar(ctx, false);
}

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  return antecipar(ctx, true);
}
