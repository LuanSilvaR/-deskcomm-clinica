/**
 * POST /api/v1/clinic/estoque/inventarios/:id/cancelar — FORK clinic (estoque E6).
 *
 * Cancela um inventário aberto; o saldo não muda. `estoque.inventariar`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.inventariar", { requestId, resource: "clinic_estoque_inventarios" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = z.object({}).strict().safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_inventario_cancelar", {
    p_org: org,
    p_inventario: id,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.estoque_inventario_cancelado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_inventario",
    resourceId: id,
    requestId,
    metadata: {},
  });
  return ok(data as { status: string }, { requestId });
}
