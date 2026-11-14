/**
 * POST /api/v1/clinic/agendamentos/[id]/dados-confirmados — FORK clinic (agenda S4).
 *
 * A recepção conferiu telefone e e-mail do paciente recorrente ("Confirmar
 * dados"). O que foi EDITADO já foi gravado no contato pela rota dele; aqui
 * fica só o registro de QUEM conferiu e COMO (correto, editado, não possui),
 * na auditoria — sem o dado em si.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const SITUACAO = z.enum(["correto", "editado", "nao_possui"]);
const corpoSchema = z.object({ telefone: SITUACAO, email: SITUACAO });

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("recepcao.mudar_status_visita", { requestId, resource: "calendar_appointments" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });
  const lido = corpoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: ag } = await supabase.from("calendar_appointments").select("contact_id").eq("organization_id", org).eq("id", id).maybeSingle();
  if (!ag) return fail("not_found", t("Agendamento não encontrado."), 404, { requestId });

  void audit({
    action: "clinic.dados_confirmados",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "calendar_appointment",
    resourceId: id,
    requestId,
    metadata: { contact_id: (ag as { contact_id: string | null }).contact_id, telefone: lido.data.telefone, email: lido.data.email },
  });
  return ok({ registrado: true }, { requestId });
}
