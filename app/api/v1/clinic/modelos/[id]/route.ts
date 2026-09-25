/**
 * PATCH /api/v1/clinic/modelos/:id — nome, descrição, especialidades e ativo
 * (FORK clinic, prontuário F3). Os campos só mudam publicando versão nova.
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
    nome: z.string().trim().min(1).max(80),
    descricao: z.string().trim().max(300).nullish(),
    especialidades: z.array(z.string().uuid()).max(50),
    ativo: z.boolean(),
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("modelos_clinicos.gerenciar", { requestId, resource: "clinic_modelos_formulario" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const d = lido.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_clinic_modelo_atualizar", {
    p_org: org,
    p_modelo: id,
    p_nome: d.nome,
    p_descricao: d.descricao ?? null,
    p_especialidades: d.especialidades,
    p_ativo: d.ativo,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.modelo_atualizado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_modelo_formulario",
    resourceId: id,
    requestId,
    metadata: { ativo: d.ativo, especialidades: d.especialidades.length },
  });
  return ok({ id }, { requestId });
}
