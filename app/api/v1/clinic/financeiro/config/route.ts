/**
 * GET/PATCH /api/v1/clinic/financeiro/config — FORK clinic (financeiro FN2):
 * as regras do financeiro da clínica — base da comissão (`liquido`, padrão,
 * ou `bruto`) e a margem mínima do alerta (padrão 30%). Ler: `financeiro.ver`;
 * mudar: `financeiro.configurar`.
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
import { configFinanceiroSchema } from "@/lib/clinic/financeiro/schemas";
import { lerConfigFinanceiro } from "@/lib/clinic/financeiro/servidor";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.ver", { requestId, resource: "organization" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("settings").eq("id", authz.org.orgId).maybeSingle();
  return ok(lerConfigFinanceiro((data as { settings?: unknown } | null)?.settings), { requestId });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.configurar", { requestId, resource: "organization" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = configFinanceiroSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_clinic_fin_config_salvar", { p_org: authz.org.orgId, p_dados: lido.data });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.fin_config_salva",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "organization",
    resourceId: authz.org.orgId,
    requestId,
    metadata: { ...lido.data },
  });
  const { data } = await supabase.from("organizations").select("settings").eq("id", authz.org.orgId).maybeSingle();
  return ok(lerConfigFinanceiro((data as { settings?: unknown } | null)?.settings), { requestId });
}
