/**
 * PUT /api/v1/clinic/financeiro/formas/[id] — FORK clinic (financeiro FN1): o
 * tipo (Pix, débito, crédito…) e a maquininha de uma forma de pagamento.
 * `financeiro.taxas` + opção ligada.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoFinanceiro } from "@/lib/clinic/financeiro/erros";
import { formaSchema } from "@/lib/clinic/financeiro/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.taxas", { requestId, resource: "clinic_fin_forma_extras" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = formaSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Dados inválidos."), 422, { requestId });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_clinic_fin_forma_salvar", {
    p_org: authz.org.orgId,
    p_payment_method: id,
    p_tipo: lido.data.tipo,
    p_adquirente: lido.data.adquirente_id,
  });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.fin_forma_configurada",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "payment_method",
    resourceId: id,
    requestId,
    metadata: { tipo: lido.data.tipo, adquirente_id: lido.data.adquirente_id },
  });
  return ok({ id }, { requestId });
}
