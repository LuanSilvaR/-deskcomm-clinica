/**
 * PATCH /api/v1/clinic/planos/:id — título, objetivo, período e status do
 * plano (FORK clinic, prontuário F4). `versao` é a que a tela conhecia.
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

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish();
const corpo = z
  .object({
    titulo: z.string().trim().min(1).max(120),
    objetivo: z.string().max(2000).nullish(),
    observacoes: z.string().max(2000).nullish(),
    inicio: data,
    previsao_fim: data,
    status: z.enum(["rascunho", "ativo", "pausado", "concluido", "cancelado"]),
    versao: z.number().int().min(1),
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("planos.gerenciar", { requestId, resource: "clinic_planos_tratamento" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const d = lido.data;

  const supabase = await createClient();
  const { data: r, error } = await supabase.rpc("fn_clinic_plano_salvar", {
    p_org: org,
    p_plano: id,
    p_contact: null,
    p_titulo: d.titulo,
    p_objetivo: d.objetivo ?? null,
    p_observacoes: d.observacoes ?? null,
    p_inicio: d.inicio ?? null,
    p_previsao_fim: d.previsao_fim ?? null,
    p_specialty: null,
    p_atendimento_origem: null,
    p_status: d.status,
    p_versao_esperada: d.versao,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.plano_atualizado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_plano_tratamento",
    resourceId: id,
    requestId,
    metadata: { status: d.status },
  });
  return ok(r as { id: string; versao: number }, { requestId });
}
