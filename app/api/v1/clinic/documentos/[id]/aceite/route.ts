/**
 * POST /api/v1/clinic/documentos/:id/aceite — aceite PRESENCIAL (tablet da
 * clínica): nome digitado por quem aceita e sim/não em cada opção (FORK clinic,
 * prontuário F6). O banco registra canal, navegador e quem colheu.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { escolhasSchema } from "@/lib/clinic/documentos/tipos";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const corpo = z.object({ nome: z.string().trim().min(3).max(160), escolhas: escolhasSchema }).strict();

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("documentos.colher_aceite", { requestId, resource: "clinic_documentos_emitidos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Digite o nome completo de quem aceita."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_clinic_documento_aceitar", {
    p_org: org,
    p_documento: id,
    p_nome: lido.data.nome,
    p_escolhas: lido.data.escolhas,
    p_user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.documento_aceito",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_documento",
    resourceId: id,
    requestId,
    metadata: { canal: "presencial" },
  });
  return ok({ id }, { requestId });
}
