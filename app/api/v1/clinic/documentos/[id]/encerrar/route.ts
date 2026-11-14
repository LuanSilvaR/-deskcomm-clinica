/**
 * POST /api/v1/clinic/documentos/:id/encerrar — `revogar` um aceite (ex.: o
 * paciente retira a autorização de uso de imagem) ou `cancelar` um documento
 * ainda não respondido (FORK clinic, prontuário F6). Nada é apagado: a
 * revogação é um registro novo ao lado do aceite.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const corpo = z.object({ acao: z.enum(["revogar", "cancelar"]), motivo: z.string().trim().min(3).max(300) }).strict();

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  const authz = await requirePermission(lido.success && lido.data.acao === "revogar" ? "documentos.revogar" : "documentos.emitir", {
    requestId,
    resource: "clinic_documentos_emitidos",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  if (!lido.success) return fail("validation_failed", t("Informe o motivo."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_clinic_documento_encerrar", {
    p_org: org,
    p_documento: id,
    p_acao: lido.data.acao,
    p_motivo: lido.data.motivo,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: lido.data.acao === "revogar" ? "clinic.documento_revogado" : "clinic.documento_cancelado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_documento",
    resourceId: id,
    requestId,
    metadata: {},
  });
  return ok({ id }, { requestId });
}
