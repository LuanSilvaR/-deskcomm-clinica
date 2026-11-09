/**
 * PUT /api/v1/clinic/marca/cor-filetes — a cor dos filetes do papel timbrado
 * (FORK clinic, 8013). Corpo: `{ hex: "#rrggbb" | null }` (null volta ao tom
 * derivado da cor da marca).
 *
 * Mesmos gates da rota do favicon: suporte de escrita → sessão → organização
 * ativa → admin → MFA. A organização vem da sessão; quem grava é
 * `fn_clinic_definir_cor_filetes` (service role), que re-confere papel e formato.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { loadAuthUser, mfaEmDivida, resolveActiveOrg } from "@/lib/auth/server";
import { roleAtLeast } from "@/lib/auth/types";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({ hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable() }).strict();

export async function PUT(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();

  const user = await loadAuthUser();
  if (!user) return fail("unauthenticated", "Faça login.", 401, { requestId });
  const org = await resolveActiveOrg(user);
  if (!org) return fail("forbidden_tenant", "Sem organização ativa.", 403, { requestId });
  if (!user.is_platform_admin && !roleAtLeast(org.role, "admin")) {
    return fail("forbidden_role", "Só quem administra a empresa pode mudar o papel timbrado.", 403, { requestId });
  }
  if (await mfaEmDivida()) {
    return fail("mfa_required", "Confirme o segundo fator nesta sessão para mudar o papel timbrado.", 403, { requestId });
  }

  const lido = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!lido.success) return fail("validation_failed", "Use uma cor como #d4af7c.", 422, { requestId });

  const { data, error } = await createAdminClient().rpc("fn_clinic_definir_cor_filetes", {
    p_org: org.orgId,
    p_actor: user.id,
    p_hex: lido.data.hex,
  });
  if (error) {
    if (error.code === "42501") return fail("forbidden_role", "Só quem administra a empresa pode mudar o papel timbrado.", 403, { requestId });
    if (error.code === "22023") return fail("validation_failed", "Use uma cor como #d4af7c.", 422, { requestId });
    logger.error("[marca/cor-filetes] gravação falhou", { codigo: error.code, detalhe: error.message });
    return fail("internal_error", "Erro ao gravar a cor.", 500, { requestId });
  }
  if (data !== 1) return fail("internal_error", "A cor não foi gravada.", 500, { requestId });

  await audit({
    action: "org.branding_updated",
    actorUserId: user.id,
    organizationId: org.orgId,
    resourceType: "organization",
    resourceId: org.orgId,
    requestId,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
    metadata: { fields_changed: ["cor_filetes"] },
  });
  return ok({ cor_filetes: lido.data.hex?.toLowerCase() ?? null }, { requestId });
}
