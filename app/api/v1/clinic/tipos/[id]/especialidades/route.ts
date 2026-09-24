/**
 * /api/v1/clinic/tipos/:id/especialidades — o que um tipo de atendimento exige.
 *
 * GET (viewer): os ids exigidos (lista vazia = qualquer profissional).
 * PUT (manager): substitui a lista inteira.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { falhaDoBanco, idsSaoDaOrg } from "@/lib/clinic/api";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("profissionais.ver", { requestId, resource: "clinic_event_type_specialties" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_event_type_specialties")
    .select("specialty_id")
    .eq("organization_id", authz.org.orgId)
    .eq("event_type_id", id);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ specialty_ids: (data ?? []).map((l) => l.specialty_id as string) }, { requestId });
}

const putSchema = z.object({ specialty_ids: z.array(z.string().uuid()).max(50) });

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("profissionais.gerenciar", { requestId, resource: "clinic_event_type_specialties" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const lido = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Lista de especialidades inválida."), 422, { requestId });

  const org = authz.org.orgId;
  const supabase = await createClient();
  if (!(await idsSaoDaOrg(supabase, "calendar_event_types", org, [id]))) {
    return fail("not_found", t("Tipo de atendimento não encontrado."), 404, { requestId });
  }
  const ids = [...new Set(lido.data.specialty_ids)];
  if (!(await idsSaoDaOrg(supabase, "clinic_specialties", org, ids))) {
    return fail("validation_failed", t("Alguma especialidade não existe nesta empresa."), 422, { requestId });
  }

  const { error: erroApagar } = await supabase
    .from("clinic_event_type_specialties")
    .delete()
    .eq("organization_id", org)
    .eq("event_type_id", id);
  if (erroApagar) return falhaDoBanco(erroApagar, requestId, t);
  if (ids.length > 0) {
    const { error } = await supabase
      .from("clinic_event_type_specialties")
      .insert(ids.map((specialty_id) => ({ organization_id: org, event_type_id: id, specialty_id })));
    if (error) return falhaDoBanco(error, requestId, t);
  }

  void audit({
    action: "clinic.tipo_especialidades_atualizadas",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "calendar_event_type",
    resourceId: id,
    requestId,
    metadata: { especialidades: ids.length },
  });
  return ok({ specialty_ids: ids }, { requestId });
}
