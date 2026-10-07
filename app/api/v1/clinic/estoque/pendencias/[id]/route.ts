/**
 * POST /api/v1/clinic/estoque/pendencias/:id — FORK clinic (estoque E2).
 *
 * Resolve uma pendência da baixa pelo prontuário:
 *   { acao: "baixar", lote_id, local_id }  tira do estoque e liga ao insumo;
 *   { acao: "descartar", motivo }          o insumo não saiu do estoque;
 *   { acao: "ciente", motivo }             controlado revisado.
 * `estoque.movimentar`; a função confere empresa, opção, lote do produto e saldo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { pendenciaSchema } from "@/lib/clinic/estoque/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.movimentar", {
    requestId,
    resource: "clinic_estoque_pendencias",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = pendenciaSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_pendencia_resolver", {
    p_org: org,
    p_pendencia: id,
    p_dados: lido.data,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.estoque_pendencia_resolvida",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_pendencia",
    resourceId: id,
    requestId,
    metadata: { tipo: lido.data.acao },
  });
  return ok(data as { status: string; operacao_id?: string }, { requestId });
}
