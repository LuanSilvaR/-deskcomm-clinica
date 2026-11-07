/**
 * PATCH /api/v1/clinic/orcamentos/[id] — FORK clinic (orçamento O2): edita o
 * rascunho (`orcamentos.criar`). Itens são regravados com o preço da vigência
 * atual; o paciente do orçamento não muda. Enviado/cancelado não se edita.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoOrcamento } from "@/lib/clinic/orcamentos/erros";
import { editarOrcamentoSchema } from "@/lib/clinic/orcamentos/orcamento";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.criar", { requestId, resource: "clinic_orcamentos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("not_found", t("Orçamento não encontrado."), 404, { requestId });
  const lido = editarOrcamentoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Dados inválidos."), 422, { requestId });
  }
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_orcamento_salvar", { p_org: org, p_id: id, p_dados: lido.data });
  if (error) {
    const e = erroDoOrcamento(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; numero: number; total_cents: number; desconto_pendente: boolean };
  void audit({
    action: "clinic.orcamento_salvo",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_orcamento",
    resourceId: r.id,
    requestId,
    metadata: { numero: r.numero, total_cents: r.total_cents, itens: lido.data.itens.length, criado: false },
  });
  return ok(r, { requestId });
}
