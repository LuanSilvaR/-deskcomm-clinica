/**
 * POST /api/v1/clinic/financeiro/caixa/[id]/fechar — FORK clinic (financeiro
 * FN3): fecha com a contagem por cédula/moeda. Diferença ou valor acima do
 * limite ficam aguardando a conferência de outra pessoa. `financeiro.caixa`.
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
import { fecharCaixaSchema } from "@/lib/clinic/financeiro/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.caixa", { requestId, resource: "clinic_fin_caixas" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = fecharCaixaSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Contagem inválida."), 422, { requestId });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_fin_caixa_fechar", {
    p_org: authz.org.orgId,
    p_caixa: id,
    p_contagem: lido.data.contagem,
    p_observacao: lido.data.observacao,
  });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { esperado_cents: number; contado_cents: number; diferenca_cents: number; precisa_conferencia: boolean };
  void audit({
    action: "clinic.fin_caixa_fechado",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_fin_caixa",
    resourceId: id,
    requestId,
    metadata: { ...r },
  });
  return ok(r, { requestId });
}
