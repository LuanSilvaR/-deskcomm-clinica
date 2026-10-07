/**
 * GET/POST /api/v1/clinic/financeiro/caixa — FORK clinic (financeiro FN3).
 * GET ?dia=AAAA-MM-DD: o dia do caixa (entradas, saídas, saldo, categorias,
 * ontem, média de 7 dias) e as sessões de caixa (`financeiro.ver`).
 * POST: abre uma sessão numa conta, com o fundo de troco (`financeiro.caixa`).
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
import { abrirCaixaSchema } from "@/lib/clinic/financeiro/schemas";
import { lerCaixaDoDia } from "@/lib/clinic/financeiro/servidor";
import { hojeNoFuso } from "@/lib/clinic/navegacao/resumo-do-dia";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.ver", { requestId, resource: "clinic_fin_caixas" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const dia = req.nextUrl.searchParams.get("dia") || hojeNoFuso(new Date(), authz.org.timezone || "America/Sao_Paulo");
  if (!z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(dia).success) {
    return fail("validation_failed", t("Data inválida."), 422, { requestId });
  }
  try {
    return ok(await lerCaixaDoDia(await createClient(), authz.org.orgId, dia), { requestId });
  } catch {
    return fail("internal_error", t("Não foi possível carregar o caixa."), 500, { requestId });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.caixa", { requestId, resource: "clinic_fin_caixas" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = abrirCaixaSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_fin_caixa_abrir", {
    p_org: authz.org.orgId,
    p_conta: lido.data.account_id,
    p_fundo_troco_cents: lido.data.fundo_troco_cents,
  });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string };
  void audit({
    action: "clinic.fin_caixa_aberto",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_fin_caixa",
    resourceId: r.id,
    requestId,
    metadata: { account_id: lido.data.account_id, fundo_troco_cents: lido.data.fundo_troco_cents },
  });
  return ok(r, { requestId });
}
