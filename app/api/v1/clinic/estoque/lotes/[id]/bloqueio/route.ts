/**
 * POST /api/v1/clinic/estoque/lotes/:id/bloqueio — FORK clinic (estoque E10).
 *
 * Bloqueia (recall, quarentena) ou desbloqueia um lote, com motivo. Lote
 * bloqueado sai da FEFO: o sistema nunca o escolhe sozinho para um paciente.
 * `estoque.configurar`; auditado.
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

const bloqueioSchema = z
  .object({ bloquear: z.boolean(), motivo: z.string().trim().min(3).max(300) })
  .strict();

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.configurar", { requestId, resource: "clinic_estoque_lotes" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = bloqueioSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Informe o motivo."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_lote_bloquear", {
    p_org: org,
    p_lote: id,
    p_bloquear: lido.data.bloquear,
    p_motivo: lido.data.motivo,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.estoque_lote_bloqueado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_lote",
    resourceId: id,
    requestId,
    metadata: { tipo: lido.data.bloquear ? "bloquear" : "desbloquear" },
  });
  return ok(data as { bloqueado: boolean }, { requestId });
}
