/**
 * POST /api/v1/clinic/financeiro/adquirentes/[id]/tabelas — FORK clinic
 * (financeiro FN1): publica uma VIGÊNCIA da tabela de taxas. O que já foi
 * vendido continua com a taxa da época; só a primeira tabela pode valer desde
 * o passado. `financeiro.taxas` + opção ligada.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoFinanceiro } from "@/lib/clinic/financeiro/erros";
import { tabelaSchema } from "@/lib/clinic/financeiro/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.taxas", { requestId, resource: "clinic_fin_tabelas" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = tabelaSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Dados inválidos."), 422, { requestId });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_fin_tabela_publicar", {
    p_org: authz.org.orgId,
    p_adquirente: id,
    p_vigente_desde: lido.data.vigente_desde,
    p_linhas: lido.data.linhas,
  });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; substituiu: string | null };
  void audit({
    action: "clinic.fin_tabela_publicada",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_fin_tabela",
    resourceId: r.id,
    requestId,
    metadata: { adquirente_id: id, vigente_desde: lido.data.vigente_desde, linhas: lido.data.linhas.length, substituiu: r.substituiu },
  });
  return ok(r, { requestId });
}
