/**
 * GET/PATCH /api/v1/clinic/config — a flag do módulo de profissionais.
 *
 * GET: qualquer membro lê se o módulo está ligado (as telas precisam saber).
 * PATCH: só admin, por `fn_clinic_definir_flag` (migration 9001), que também
 * exige MFA provado quando a sessão tem fator — nunca UPDATE em organizations.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { clinicProfissionaisDaOrg } from "@/lib/clinic/flags";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "clinic" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const ligado = await clinicProfissionaisDaOrg(supabase, authz.org.orgId);
  return ok({ profissionais: ligado }, { requestId });
}

const patchSchema = z.object({ profissionais: z.boolean() });

export async function PATCH(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "clinic" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Informe se o módulo fica ligado."), 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_definir_flag", {
    p_org: authz.org.orgId,
    p_ligado: lido.data.profissionais,
  });
  if (error) {
    if (error.message.includes("mfa_required")) {
      return fail("mfa_required", t("Confirme a verificação em duas etapas para mudar esta opção."), 403, {
        requestId,
      });
    }
    if (error.code === "42501") {
      return fail("forbidden", t("Só quem administra a empresa pode mudar esta opção."), 403, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }

  const resultado = data as { ligado: boolean; mudou: boolean };
  if (resultado.mudou) {
    void audit({
      action: "clinic.flag_alterada",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "organization",
      resourceId: authz.org.orgId,
      requestId,
      metadata: { profissionais: resultado.ligado },
    });
  }
  return ok({ profissionais: resultado.ligado }, { requestId });
}
