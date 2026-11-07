/**
 * POST /api/v1/clinic/orcamentos/[id]/nova-versao — FORK clinic (orçamento O3):
 * revisar um orçamento enviado, recusado ou expirado (`orcamentos.criar`).
 * Cria um RASCUNHO com o mesmo número e a versão seguinte; o enviado vira
 * "substituído" e o contrato dele é cancelado. O contrato aceito nunca muda.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoOrcamento } from "@/lib/clinic/orcamentos/erros";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.criar", { requestId, resource: "clinic_orcamentos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("not_found", t("Orçamento não encontrado."), 404, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_orcamento_nova_versao", { p_org: org, p_id: id });
  if (error) {
    const e = erroDoOrcamento(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; numero: number; versao: number };
  void audit({
    action: "clinic.orcamento_nova_versao",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_orcamento",
    resourceId: r.id,
    requestId,
    metadata: { anterior_id: id, numero: r.numero, versao: r.versao },
  });
  return ok(r, { requestId, status: 201 });
}
