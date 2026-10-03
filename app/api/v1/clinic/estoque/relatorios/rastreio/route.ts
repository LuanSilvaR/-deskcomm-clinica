/**
 * GET /api/v1/clinic/estoque/relatorios/rastreio?lote= — FORK clinic (estoque E8).
 *
 * RECALL: quais pacientes receberam um lote, quando e com qual profissional.
 * É dado de saúde: chave clínica `estoque.rastreio_lote` (administrador e
 * suporte não recebem por padrão), limite de leituras por pessoa e auditoria
 * da leitura (só ids e contagem — nunca o nome do paciente no log).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { leituraClinicaPermitida } from "@/lib/clinic/prontuario/limite";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.rastreio_lote", { requestId, resource: "clinic_estoque_lotes" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const loteId = req.nextUrl.searchParams.get("lote");
  if (!loteId || !z.string().uuid().safeParse(loteId).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  if (!(await leituraClinicaPermitida(authz.user.id, "estoque-rastreio"))) {
    return fail("rate_limited", t("Muitas leituras seguidas. Aguarde alguns minutos."), 429, { requestId });
  }
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_rel_rastreio_lote", { p_org: org, p_lote: loteId });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { lote: Record<string, unknown>; pacientes: unknown[] };
  void audit({
    action: "clinic.estoque_rastreio_consultado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_lote",
    resourceId: loteId,
    requestId,
    metadata: { numero: r.pacientes.length },
  });
  return ok(r, { requestId });
}
