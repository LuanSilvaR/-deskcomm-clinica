/**
 * /api/v1/clinic/profissionais/eu — a ficha de QUEM ESTÁ LOGADO (#97).
 *
 * GET (`agenda.bloquear_horario`): a própria ficha, com o nome das
 * especialidades. `null` = a gerência ainda não criou a ficha.
 *
 * PATCH (`agenda.bloquear_horario`): grava conselho, número e UF da própria
 * ficha pela `fn_clinic_salvar_meu_registro` (migration 8004), que só altera a
 * linha de auth.uid(). O corpo é estrito: `user_id`, especialidades e "ativo"
 * são recusados (422) — continuam com a gerência, pela rota da coleção.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { falhaDoBanco } from "@/lib/clinic/api";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLUNAS =
  "id, user_id, display_name, council, council_number, council_uf, is_active, clinic_professional_specialties(clinic_specialties(name))";

type LinhaDoBanco = {
  id: string;
  user_id: string;
  display_name: string | null;
  council: string | null;
  council_number: string | null;
  council_uf: string | null;
  is_active: boolean;
  clinic_professional_specialties: { clinic_specialties: { name: string } | null }[] | null;
};

function paraResposta(l: LinhaDoBanco) {
  const { clinic_professional_specialties: esp, ...resto } = l;
  const especialidades = (esp ?? [])
    .map((e) => e.clinic_specialties?.name)
    .filter((n): n is string => typeof n === "string")
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { ...resto, especialidades };
}

async function lerMinhaFicha(org: string, userId: string) {
  const supabase = await createClient();
  return supabase
    .from("clinic_professionals")
    .select(COLUNAS)
    .eq("organization_id", org)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("agenda.bloquear_horario", { requestId, resource: "clinic_professionals" });
  if (!authz.ok) return authz.response;

  const { data, error } = await lerMinhaFicha(authz.org.orgId, authz.user.id);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ ficha: data ? paraResposta(data as unknown as LinhaDoBanco) : null }, { requestId });
}

const meuRegistroSchema = z
  .object({
    council: z.enum(["CRM", "CRO", "COREN", "CRBM", "CFF", "CREFITO", "outro"]).nullish(),
    council_number: z.string().trim().min(1).max(30).nullish(),
    council_uf: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "UF com duas letras")
      .nullish(),
  })
  .strict();

export async function PATCH(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("agenda.bloquear_horario", { requestId, resource: "clinic_professionals" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = meuRegistroSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    const fora = lido.error.issues.find((i) => i.code === "unrecognized_keys");
    const mensagem = fora
      ? "Especialidades e situação da ficha são alteradas pela gerência."
      : (lido.error.issues[0]?.message ?? "corpo inválido");
    return fail("validation_failed", t(mensagem), 422, { requestId });
  }
  const org = authz.org.orgId;
  const supabase = await createClient();

  const { data: salvo, error } = await supabase.rpc("fn_clinic_salvar_meu_registro", {
    p_org: org,
    p_council: lido.data.council ?? "",
    p_council_number: lido.data.council_number ?? "",
    p_council_uf: lido.data.council_uf ?? "",
  });
  if (error) {
    if (error.code === "P0002") {
      return fail("not_found", t("Sua ficha ainda não foi criada. Peça à gerência da clínica."), 404, { requestId });
    }
    return falhaDoBanco(error, requestId, t);
  }

  const { data: completo, error: erroLer } = await lerMinhaFicha(org, authz.user.id);
  if (erroLer || !completo) return fail("internal_error", erroLer?.message ?? "ficha sumiu", 500, { requestId });

  void audit({
    action: "clinic.profissional.proprios_dados",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_professional",
    resourceId: (salvo as { id: string }).id,
    requestId,
    metadata: { campos: Object.keys(lido.data) },
  });
  return ok(paraResposta(completo as unknown as LinhaDoBanco), { requestId });
}
