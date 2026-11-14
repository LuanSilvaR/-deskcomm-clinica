/**
 * /api/v1/clinic/procedimentos/:id — FORK clinic (9015).
 *
 * GET (`procedimentos.ver`): o procedimento com vínculos e o resumo do POP.
 * PATCH (`procedimentos.gerenciar`): dados e ativar/desativar. Não há DELETE:
 * procedimento sai de uso DESATIVADO (o POP e o histórico ficam).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { falhaDoBanco } from "@/lib/clinic/api";
import { alterarProcedimentoSchema, codigoOuNulo } from "@/lib/clinic/procedimentos/schemas";
import { COLUNAS_DO_PROCEDIMENTO, paraProcedimento } from "@/lib/clinic/procedimentos/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("procedimentos.ver", { requestId, resource: "clinic_procedures" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_procedures")
    .select(COLUNAS_DO_PROCEDIMENTO)
    .eq("organization_id", authz.org.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", t("Procedimento não encontrado."), 404, { requestId });
  return ok(paraProcedimento(data as unknown as Parameters<typeof paraProcedimento>[0]), { requestId });
}

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("procedimentos.gerenciar", { requestId, resource: "clinic_procedures" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const lido = alterarProcedimentoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "corpo inválido"), 422, { requestId });
  }
  const mudancas = { ...lido.data, ...(lido.data.code !== undefined ? { code: codigoOuNulo(lido.data.code) } : {}) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_procedures")
    .update(mudancas)
    .eq("organization_id", authz.org.orgId)
    .eq("id", id)
    .select(COLUNAS_DO_PROCEDIMENTO)
    .maybeSingle();
  if (error) return falhaDoBanco(error, requestId, t, { conflito: "Já existe um procedimento com esse nome ou código." });
  if (!data) return fail("not_found", t("Procedimento não encontrado."), 404, { requestId });

  const soStatus = Object.keys(lido.data).length === 1 && lido.data.is_active !== undefined;
  void audit({
    action: soStatus ? (lido.data.is_active ? "clinic.procedimento_ativado" : "clinic.procedimento_desativado") : "clinic.procedimento_alterado",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_procedure",
    resourceId: id,
    requestId,
    metadata: { campos: Object.keys(lido.data) },
  });
  return ok(paraProcedimento(data as unknown as Parameters<typeof paraProcedimento>[0]), { requestId });
}
