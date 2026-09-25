/**
 * POST /api/v1/clinic/planos/sessoes/:id — agendar (liga um agendamento do
 * paciente), desagendar ou cancelar (com motivo) uma sessão do plano (FORK
 * clinic, prontuário F4). REALIZADA não se faz aqui: ela nasce quando o
 * atendimento daquele agendamento é finalizado.
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

const corpo = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("agendar"), appointment_id: z.string().uuid() }).strict(),
  z.object({ acao: z.literal("desagendar") }).strict(),
  z.object({ acao: z.literal("cancelar"), motivo: z.string().trim().min(3).max(300) }).strict(),
]);

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
  const { error } = await supabase.rpc("fn_clinic_plano_sessao_mudar", {
    p_org: org,
    p_sessao: id,
    p_acao: d.acao,
    p_appointment: d.acao === "agendar" ? d.appointment_id : null,
    p_motivo: d.acao === "cancelar" ? d.motivo : null,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.plano_sessao_alterada",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_plano_sessao",
    resourceId: id,
    requestId,
    metadata: { acao: d.acao },
  });
  return ok({ id, acao: d.acao }, { requestId });
}
