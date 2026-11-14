/**
 * POST /api/v1/clinic/modelos/:id/versoes — publica uma versão nova dos campos
 * (FORK clinic, prontuário F3). A versão anterior nunca muda: quem já preencheu
 * com ela continua lendo os mesmos campos. `versao_atual` é a que a tela
 * conhecia; outra pessoa publicou antes → 409.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { camposPublicaveisSchema } from "@/lib/clinic/formularios/campos";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const corpo = z.object({ campos: camposPublicaveisSchema, versao_atual: z.number().int().min(1) }).strict();

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("modelos_clinicos.gerenciar", { requestId, resource: "clinic_modelos_formulario" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Dados inválidos."), 422, { requestId });
  }
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_modelo_publicar_versao", {
    p_org: org,
    p_modelo: id,
    p_campos: lido.data.campos,
    p_versao_esperada: lido.data.versao_atual,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; versao_id: string; numero: number };
  void audit({
    action: "clinic.modelo_versao_publicada",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_modelo_formulario",
    resourceId: id,
    requestId,
    metadata: { numero: r.numero, campos: lido.data.campos.length },
  });
  return ok(r, { requestId });
}
