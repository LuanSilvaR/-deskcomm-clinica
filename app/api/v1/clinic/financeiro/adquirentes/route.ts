/**
 * POST /api/v1/clinic/financeiro/adquirentes — FORK clinic (financeiro FN1):
 * cadastra uma maquininha (adquirente). `financeiro.taxas` + opção ligada.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoFinanceiro } from "@/lib/clinic/financeiro/erros";
import { adquirenteSchema } from "@/lib/clinic/financeiro/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.taxas", { requestId, resource: "clinic_fin_adquirentes" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = adquirenteSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_fin_adquirente_salvar", {
    p_org: authz.org.orgId,
    p_adquirente: null,
    p_dados: lido.data,
  });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string };
  void audit({
    action: "clinic.fin_adquirente_salva",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_fin_adquirente",
    resourceId: r.id,
    requestId,
    metadata: { modelo: lido.data.modelo ?? null, novo: true },
  });
  return ok(r, { requestId });
}
