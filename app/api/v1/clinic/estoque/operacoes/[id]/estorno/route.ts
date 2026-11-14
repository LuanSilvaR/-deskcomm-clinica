/**
 * POST /api/v1/clinic/estoque/operacoes/:id/estorno — FORK clinic (estoque E0).
 *
 * Estorna uma movimentação: grava outra com as linhas invertidas (nada é
 * apagado). Uma vez só; estorno não se estorna; recusado se deixaria saldo
 * negativo (ex.: entrada cujo produto já foi usado). `estoque.estornar` + motivo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { estornoSchema } from "@/lib/clinic/estoque/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.estornar", {
    requestId,
    resource: "clinic_estoque_operacoes",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = estornoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Informe o motivo."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_estornar", {
    p_org: org,
    p_operacao: id,
    p_motivo: lido.data.motivo,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.estoque_estornado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_operacao",
    resourceId: id,
    requestId,
    metadata: {},
  });
  return ok(data as { operacao_id: string }, { requestId });
}
