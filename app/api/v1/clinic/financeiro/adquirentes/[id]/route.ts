/**
 * PATCH /api/v1/clinic/financeiro/adquirentes/[id] — FORK clinic (financeiro
 * FN1): prazos, tarifa, antecipação, nome e ativo. As TAXAS não mudam aqui:
 * cada mudança de taxa é uma vigência nova (POST .../tabelas).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoFinanceiro } from "@/lib/clinic/financeiro/erros";
import { adquirenteAlterarSchema } from "@/lib/clinic/financeiro/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.taxas", { requestId, resource: "clinic_fin_adquirentes" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = adquirenteAlterarSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_clinic_fin_adquirente_salvar", {
    p_org: authz.org.orgId,
    p_adquirente: id,
    p_dados: lido.data,
  });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.fin_adquirente_salva",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_fin_adquirente",
    resourceId: id,
    requestId,
    metadata: { campos: Object.keys(lido.data) },
  });
  return ok({ id }, { requestId });
}
