/**
 * POST /api/v1/clinic/estoque/frascos/:id/encerrar — FORK clinic (estoque E4).
 *
 * Encerra um frasco aberto (vencido, descartado, acabou): a sobra vira PERDA
 * com o motivo informado. Uma vez só. `estoque.movimentar`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { encerrarFrascoSchema } from "@/lib/clinic/estoque/schemas";
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
    resource: "clinic_estoque_frascos",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = encerrarFrascoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Informe o motivo."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_frasco_encerrar", {
    p_org: org,
    p_frasco: id,
    p_motivo: lido.data.motivo,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.estoque_movimentado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_frasco",
    resourceId: id,
    requestId,
    metadata: { tipo: "frasco_encerrado" },
  });
  return ok(data as { perda: number; operacao_id: string | null }, { requestId });
}
