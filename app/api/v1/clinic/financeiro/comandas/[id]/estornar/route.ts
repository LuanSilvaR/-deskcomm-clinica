/**
 * POST /api/v1/clinic/financeiro/comandas/[id]/estornar — FORK clinic
 * (financeiro FN2): o estorno do núcleo MAIS o contra-lançamento das parcelas,
 * taxas e antecipação (fn_clinic_fin_estornar). Vale mesmo com a opção
 * desligada depois — a venda feita com ela precisa estornar inteira.
 * `financeiro.estornar`. O motivo não entra no audit (ver a rota do núcleo).
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
import { estornarComTaxasSchema } from "@/lib/clinic/financeiro/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("financeiro.estornar", { requestId, resource: "sales" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = estornarComTaxasSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Informe o motivo do estorno."), 422, { requestId });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_fin_estornar", {
    p_org: authz.org.orgId,
    p_sale: id,
    p_motivo: lido.data.reason,
  });
  if (error) {
    const e = erroDoFinanceiro(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = (data ?? {}) as { ja_estornada?: boolean };
  if (!r.ja_estornada) {
    void audit({
      action: "clinic.fin_comanda_estornada",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "sale",
      resourceId: id,
      requestId,
      metadata: { motivo_informado: true, motivo_chars: lido.data.reason.length },
    });
  }
  return ok(r, { requestId });
}
