/**
 * POST /api/v1/clinic/financeiro/comandas/[id]/finalizar — FORK clinic
 * (financeiro FN2): fecha a comanda com PAGAMENTO DIVIDIDO, parcelas e a taxa
 * da maquininha (fn_clinic_fin_finalizar). Só com a opção financeiro_avancado;
 * desligada, o balcão usa a rota do núcleo, que não muda. `financeiro.lancar`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoFinanceiro } from "@/lib/clinic/financeiro/erros";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import { finalizarComTaxasSchema } from "@/lib/clinic/financeiro/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.lancar", { requestId, resource: "sales" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = finalizarComTaxasSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Pagamentos inválidos."), 422, { requestId });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_fin_finalizar", {
    p_org: authz.org.orgId,
    p_sale: id,
    p_pagamentos: lido.data.pagamentos,
    p_loyalty_points: lido.data.loyalty_points,
  });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = (data ?? {}) as { ja_finalizada?: boolean; total_cents?: number; liquido_cents?: number };
  if (!r.ja_finalizada) {
    void audit({
      action: "clinic.fin_comanda_finalizada",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "sale",
      resourceId: id,
      requestId,
      metadata: {
        formas: lido.data.pagamentos.length,
        parcelas_max: Math.max(...lido.data.pagamentos.map((p) => p.parcelas)),
        total_cents: r.total_cents ?? null,
        liquido_cents: r.liquido_cents ?? null,
      },
    });
  }
  return ok(r, { requestId });
}
