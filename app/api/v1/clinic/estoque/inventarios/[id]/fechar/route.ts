/**
 * POST /api/v1/clinic/estoque/inventarios/:id/fechar — FORK clinic (estoque E6).
 *
 * Fecha o inventário: UMA operação `inventario` com a diferença de cada lote
 * contado (contado − saldo agora), com motivo. `estoque.inventariar`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { fecharInventarioSchema } from "@/lib/clinic/estoque/schemas";
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
  const lido = fecharInventarioSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_inventario_fechar", {
    p_org: org,
    p_inventario: id,
    p_motivo: lido.data.motivo ?? null,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.estoque_inventario_fechado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_inventario",
    resourceId: id,
    requestId,
    metadata: { numero: (data as { ajustes?: number } | null)?.ajustes ?? 0 },
  });
  return ok(data as { ajustes: number; operacao_id: string | null }, { requestId });
}
