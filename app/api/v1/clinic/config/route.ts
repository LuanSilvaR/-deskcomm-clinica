/**
 * GET/PATCH /api/v1/clinic/config — as opções do módulo clinic.
 *
 * `profissionais`: regras de especialidade e bloqueios na agenda (migration 9001).
 * `ficha_obrigatoria`: exigir a ficha completa do paciente na chegada e no
 * "Compareceu" (migration 9002).
 *
 * GET: qualquer membro lê (as telas precisam saber). PATCH: só admin, pelas
 * funções `fn_clinic_definir_*`, que também exigem MFA provado quando a sessão
 * tem fator — nunca UPDATE em organizations.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { clinicProfissionaisLigado } from "@/lib/clinic/flags";
import { fichaObrigatoriaLigada } from "@/lib/clinic/pacientes/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function lerOpcoes(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  const settings = (data as { settings?: unknown } | null)?.settings;
  return {
    profissionais: clinicProfissionaisLigado(settings),
    ficha_obrigatoria: fichaObrigatoriaLigada(settings),
  };
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "clinic" });
  if (!authz.ok) return authz.response;
  return ok(await lerOpcoes(authz.org.orgId), { requestId });
}

const patchSchema = z
  .object({ profissionais: z.boolean().optional(), ficha_obrigatoria: z.boolean().optional() })
  .refine((v) => v.profissionais !== undefined || v.ficha_obrigatoria !== undefined, {
    message: "Informe se o módulo fica ligado.",
  });

const FUNCAO_DA_OPCAO = {
  profissionais: "fn_clinic_definir_flag",
  ficha_obrigatoria: "fn_clinic_definir_ficha_obrigatoria",
} as const;

export async function PATCH(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "clinic" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "Informe se o módulo fica ligado."), 422, {
      requestId,
    });
  }

  const supabase = await createClient();
  for (const opcao of ["profissionais", "ficha_obrigatoria"] as const) {
    const valor = lido.data[opcao];
    if (valor === undefined) continue;
    const { data, error } = await supabase.rpc(FUNCAO_DA_OPCAO[opcao], { p_org: authz.org.orgId, p_ligado: valor });
    if (error) {
      if (error.message.includes("mfa_required")) {
        return fail("mfa_required", t("Confirme a verificação em duas etapas para mudar esta opção."), 403, { requestId });
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
        metadata: { [opcao]: resultado.ligado },
      });
    }
  }
  return ok(await lerOpcoes(authz.org.orgId), { requestId });
}
