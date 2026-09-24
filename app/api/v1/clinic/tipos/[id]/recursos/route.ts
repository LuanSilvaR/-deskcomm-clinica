/**
 * /api/v1/clinic/tipos/:id/recursos — as salas e equipamentos que um tipo de
 * atendimento exige (migration 9007).
 *
 * GET (viewer): `exigencias: [{ category } | { resource_id }]`. Vazia = não exige.
 * PUT (manager): substitui a lista inteira. Repetir a categoria pede mais de um
 * recurso dela ao mesmo tempo ("duas salas").
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { falhaDoBanco, idsSaoDaOrg } from "@/lib/clinic/api";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "clinic_event_type_resources" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_event_type_resources")
    .select("category, resource_id")
    .eq("organization_id", authz.org.orgId)
    .eq("event_type_id", id)
    .order("created_at");
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ exigencias: data ?? [] }, { requestId });
}

const exigencia = z.union([
  z.object({ category: z.string().trim().min(1).max(40), resource_id: z.null().optional() }),
  z.object({ resource_id: z.string().uuid(), category: z.null().optional() }),
]);
const putSchema = z.object({ exigencias: z.array(exigencia).max(10) });

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "clinic_event_type_resources" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const lido = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Lista de salas e equipamentos inválida."), 422, { requestId });

  const org = authz.org.orgId;
  const supabase = await createClient();
  if (!(await idsSaoDaOrg(supabase, "calendar_event_types", org, [id]))) {
    return fail("not_found", t("Tipo de atendimento não encontrado."), 404, { requestId });
  }
  const especificos = [...new Set(lido.data.exigencias.flatMap((e) => ("resource_id" in e && e.resource_id ? [e.resource_id] : [])))];
  if (!(await idsSaoDaOrg(supabase, "clinic_resources", org, especificos))) {
    return fail("validation_failed", t("Alguma sala ou equipamento não existe nesta empresa."), 422, { requestId });
  }

  const { error: erroApagar } = await supabase
    .from("clinic_event_type_resources")
    .delete()
    .eq("organization_id", org)
    .eq("event_type_id", id);
  if (erroApagar) return falhaDoBanco(erroApagar, requestId, t);
  const linhas = lido.data.exigencias.map((e) =>
    "resource_id" in e && e.resource_id
      ? { organization_id: org, event_type_id: id, category: null, resource_id: e.resource_id }
      : { organization_id: org, event_type_id: id, category: (e as { category: string }).category, resource_id: null },
  );
  if (linhas.length > 0) {
    const { error } = await supabase.from("clinic_event_type_resources").insert(linhas);
    if (error) return falhaDoBanco(error, requestId, t);
  }

  void audit({
    action: "clinic.tipo_recursos_atualizados",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "calendar_event_type",
    resourceId: id,
    requestId,
    metadata: { exigencias: linhas.length },
  });
  return ok({ exigencias: linhas.map(({ category, resource_id }) => ({ category, resource_id })) }, { requestId });
}
