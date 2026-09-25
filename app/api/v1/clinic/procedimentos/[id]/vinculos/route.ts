/**
 * PUT /api/v1/clinic/procedimentos/:id/vinculos — FORK clinic (9015).
 *
 * Troca as especialidades e os profissionais do procedimento pelo conjunto
 * enviado (`procedimentos.gerenciar`). Usa SÓ os cadastros existentes; recusa
 * id de outra empresa e profissional sem nenhuma das especialidades (422 com os
 * ids em `details.profissionais`).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { vinculosSchema } from "@/lib/clinic/procedimentos/schemas";
import { COLUNAS_DO_PROCEDIMENTO, paraProcedimento, salvarVinculos } from "@/lib/clinic/procedimentos/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

import { falhaDosVinculos } from "../../_falhas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("procedimentos.gerenciar", { requestId, resource: "clinic_procedures" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const lido = vinculosSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Vínculos inválidos."), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: existe } = await supabase.from("clinic_procedures").select("id").eq("organization_id", org).eq("id", id).maybeSingle();
  if (!existe) return fail("not_found", t("Procedimento não encontrado."), 404, { requestId });

  const r = await salvarVinculos(supabase, org, id, lido.data.specialty_ids, lido.data.professional_ids);
  if (!r.ok) return falhaDosVinculos(r, requestId, t);

  void audit({
    action: "clinic.procedimento_vinculos_alterados",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_procedure",
    resourceId: id,
    requestId,
    metadata: { especialidades: lido.data.specialty_ids.length, profissionais: lido.data.professional_ids.length },
  });
  const { data } = await supabase.from("clinic_procedures").select(COLUNAS_DO_PROCEDIMENTO).eq("organization_id", org).eq("id", id).single();
  return ok(paraProcedimento(data as unknown as Parameters<typeof paraProcedimento>[0]), { requestId });
}
