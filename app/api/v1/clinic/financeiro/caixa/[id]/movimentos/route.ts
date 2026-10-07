/**
 * POST /api/v1/clinic/financeiro/caixa/[id]/movimentos — FORK clinic
 * (financeiro FN3): suprimento, sangria ou caixa pequeno numa sessão aberta.
 * `financeiro.caixa`. A descrição não vai para o audit (texto livre).
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
import { movimentoDeCaixaSchema } from "@/lib/clinic/financeiro/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.caixa", { requestId, resource: "clinic_fin_caixa_movimentos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = movimentoDeCaixaSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Dados inválidos."), 422, { requestId });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_fin_caixa_movimentar", {
    p_org: authz.org.orgId,
    p_caixa: id,
    p_tipo: lido.data.tipo,
    p_valor_cents: lido.data.valor_cents,
    p_descricao: lido.data.descricao,
    p_plano: lido.data.account_plan_id,
  });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.fin_caixa_movimentado",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_fin_caixa",
    resourceId: id,
    requestId,
    metadata: { tipo: lido.data.tipo, valor_cents: lido.data.valor_cents },
  });
  return ok(data, { requestId });
}
