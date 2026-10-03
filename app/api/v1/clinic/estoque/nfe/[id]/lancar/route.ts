/**
 * POST /api/v1/clinic/estoque/nfe/:id/lancar — FORK clinic (estoque E5).
 *
 * Lança a nota conferida: entrada por item no local escolhido (custo rateado
 * por unidade), aprende o de/para e, com `conta_id`, cria a conta a pagar
 * pendente (exige `financeiro.lancar` — o banco confere). `estoque.compras`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { lancarNfeSchema } from "@/lib/clinic/estoque/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.compras", { requestId, resource: "clinic_estoque_nfe" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = lancarNfeSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_nfe_lancar", {
    p_org: org,
    p_nfe: id,
    p_dados: lido.data,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.estoque_nfe_lancada",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_nfe",
    resourceId: id,
    requestId,
    metadata: { tipo: lido.data.conta_id ? "com_conta_a_pagar" : "sem_conta_a_pagar" },
  });
  return ok(data as { entradas: number; financial_entry_id: string | null }, { requestId });
}
