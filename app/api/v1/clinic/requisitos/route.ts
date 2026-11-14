/**
 * FORK clinic (prontuário F3) — requisitos de finalização.
 *
 * GET /api/v1/clinic/requisitos — as regras da clínica e as opções da tela
 *     (tipos de atendimento e especialidades).
 * PUT /api/v1/clinic/requisitos — troca a lista inteira de regras.
 *
 * Cada regra: "para finalizar, a seção X precisa estar preenchida", valendo
 * para a clínica toda ou só para um tipo e/ou especialidade. A evolução é
 * sempre obrigatória e não aparece aqui.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { SECOES_EXIGIVEIS } from "@/lib/clinic/atendimento/requisitos";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const regra = z
  .object({
    secao: z.enum(SECOES_EXIGIVEIS),
    event_type_id: z.string().uuid().nullish(),
    specialty_id: z.string().uuid().nullish(),
  })
  .strict();
const corpo = z.object({ regras: z.array(regra).max(200) }).strict();

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("modelos_clinicos.gerenciar", { requestId, resource: "clinic_requisitos_finalizacao" });
  if (!authz.ok) return authz.response;
  const org = authz.org.orgId;
  const supabase = await createClient();
  const [regras, tipos, especialidades] = await Promise.all([
    supabase
      .from("clinic_requisitos_finalizacao")
      .select("id, secao, event_type_id, specialty_id")
      .eq("organization_id", org)
      .order("created_at", { ascending: true }),
    supabase.from("calendar_event_types").select("id, name").eq("organization_id", org).order("name", { ascending: true }),
    supabase
      .from("clinic_specialties")
      .select("id, name")
      .eq("organization_id", org)
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);
  const erro = regras.error ?? tipos.error ?? especialidades.error;
  if (erro) return fail("internal_error", erro.message, 500, { requestId });
  return ok(
    {
      regras: regras.data ?? [],
      tipos: (tipos.data ?? []).map((x) => ({ id: x.id as string, nome: x.name as string })),
      especialidades: (especialidades.data ?? []).map((x) => ({ id: x.id as string, nome: x.name as string })),
      secoes: SECOES_EXIGIVEIS,
    },
    { requestId },
  );
}

export async function PUT(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("modelos_clinicos.gerenciar", { requestId, resource: "clinic_requisitos_finalizacao" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_definir_requisitos", {
    p_org: org,
    p_regras: lido.data.regras.map((r) => ({
      secao: r.secao,
      event_type_id: r.event_type_id ?? null,
      specialty_id: r.specialty_id ?? null,
    })),
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.requisitos_definidos",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_requisitos_finalizacao",
    resourceId: null,
    requestId,
    metadata: { regras: data as number },
  });
  return ok({ regras: data as number }, { requestId });
}
