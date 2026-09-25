/**
 * POST /api/v1/clinic/planos/:id/sessoes — acrescenta N sessões PLANEJADAS
 * (FORK clinic, prontuário F4), com previsão a cada `intervalo_dias` a partir
 * de `primeira`.
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

const corpo = z
  .object({
    descricao: z.string().trim().min(1).max(200),
    event_type_id: z.string().uuid().nullish(),
    quantidade: z.number().int().min(1).max(50),
    primeira: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    intervalo_dias: z.number().int().min(0).max(365).default(0),
  })
  .strict();

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("planos.gerenciar", { requestId, resource: "clinic_plano_sessoes" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const d = lido.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_plano_adicionar_sessoes", {
    p_org: org,
    p_plano: id,
    p_descricao: d.descricao,
    p_event_type: d.event_type_id ?? null,
    p_procedure: null,
    p_quantidade: d.quantidade,
    p_primeira: d.primeira ?? null,
    p_intervalo_dias: d.intervalo_dias,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.plano_sessoes_adicionadas",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_plano_tratamento",
    resourceId: id,
    requestId,
    metadata: { quantidade: d.quantidade },
  });
  return ok({ adicionadas: data as number }, { requestId });
}
