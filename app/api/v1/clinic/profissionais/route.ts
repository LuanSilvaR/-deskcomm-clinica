/**
 * /api/v1/clinic/profissionais — a ficha do profissional (1:1 com um membro).
 *
 * GET (viewer): as fichas com as especialidades de cada uma. Com `?tipo=<uuid>`
 * devolve também `habilitados`: os user_id que podem ser marcados para aquele
 * tipo de atendimento (`null` = o tipo não exige especialidade, todos servem).
 * O nome da pessoa não mora aqui: a tela junta com /api/v1/agenda/pessoas.
 *
 * POST (manager): cria ou atualiza a ficha de um membro (upsert por
 * organização + user_id) e substitui as especialidades dele.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { eMembroDaOrg, falhaDoBanco, idsSaoDaOrg } from "@/lib/clinic/api";
import { profissionaisHabilitados } from "@/lib/clinic/profissionais/habilitacao";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLUNAS =
  "id, user_id, display_name, council, council_number, council_uf, is_active, clinic_professional_specialties(specialty_id)";

type LinhaDoBanco = {
  id: string;
  user_id: string;
  display_name: string | null;
  council: string | null;
  council_number: string | null;
  council_uf: string | null;
  is_active: boolean;
  clinic_professional_specialties: { specialty_id: string }[] | null;
};

function paraResposta(l: LinhaDoBanco) {
  const { clinic_professional_specialties: esp, ...resto } = l;
  return { ...resto, specialty_ids: (esp ?? []).map((e) => e.specialty_id) };
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "clinic_professionals" });
  if (!authz.ok) return authz.response;

  const tipo = new URL(req.url).searchParams.get("tipo");
  if (tipo !== null && !z.string().uuid().safeParse(tipo).success) {
    return fail("validation_failed", "tipo inválido", 422, { requestId });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_professionals")
    .select(COLUNAS)
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const profissionais = ((data ?? []) as LinhaDoBanco[]).map(paraResposta);
  if (tipo === null) return ok({ profissionais }, { requestId });

  const habilitados = await profissionaisHabilitados(supabase, authz.org.orgId, tipo);
  if (!habilitados.ok) return fail("internal_error", habilitados.erro, 500, { requestId });
  return ok({ profissionais, habilitados: habilitados.userIds }, { requestId });
}

const salvarSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().trim().min(1).max(120).nullish(),
  council: z.enum(["CRM", "CRO", "COREN", "CRBM", "CFF", "CREFITO", "outro"]).nullish(),
  council_number: z.string().trim().min(1).max(30).nullish(),
  council_uf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "UF com duas letras")
    .nullish(),
  is_active: z.boolean().default(true),
  specialty_ids: z.array(z.string().uuid()).max(50).default([]),
});

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "clinic_professionals" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = salvarSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "corpo inválido"), 422, { requestId });
  }
  const org = authz.org.orgId;
  const supabase = await createClient();

  if (!(await eMembroDaOrg(supabase, org, lido.data.user_id))) {
    return fail("validation_failed", t("Essa pessoa não é membro da equipe."), 422, { requestId });
  }
  if (!(await idsSaoDaOrg(supabase, "clinic_specialties", org, lido.data.specialty_ids))) {
    return fail("validation_failed", t("Alguma especialidade não existe nesta empresa."), 422, { requestId });
  }

  const { specialty_ids, ...ficha } = lido.data;
  const { data: salvo, error } = await supabase
    .from("clinic_professionals")
    .upsert(
      {
        organization_id: org,
        user_id: ficha.user_id,
        display_name: ficha.display_name ?? null,
        council: ficha.council ?? null,
        council_number: ficha.council_number ?? null,
        council_uf: ficha.council_uf ?? null,
        is_active: ficha.is_active,
      },
      { onConflict: "organization_id,user_id" },
    )
    .select("id")
    .single();
  if (error) return falhaDoBanco(error, requestId, t);

  // Substitui as especialidades: apaga as que saíram, insere as que entraram.
  const { error: erroApagar } = await supabase
    .from("clinic_professional_specialties")
    .delete()
    .eq("organization_id", org)
    .eq("professional_id", salvo.id)
    .not("specialty_id", "in", `(${specialty_ids.length ? specialty_ids.join(",") : "00000000-0000-0000-0000-000000000000"})`);
  if (erroApagar) return falhaDoBanco(erroApagar, requestId, t);
  if (specialty_ids.length > 0) {
    const { error: erroInserir } = await supabase.from("clinic_professional_specialties").upsert(
      specialty_ids.map((specialty_id) => ({ organization_id: org, professional_id: salvo.id, specialty_id })),
      { onConflict: "professional_id,specialty_id", ignoreDuplicates: true },
    );
    if (erroInserir) return falhaDoBanco(erroInserir, requestId, t);
  }

  const { data: completo, error: erroLer } = await supabase
    .from("clinic_professionals")
    .select(COLUNAS)
    .eq("id", salvo.id)
    .eq("organization_id", org)
    .single();
  if (erroLer) return fail("internal_error", erroLer.message, 500, { requestId });

  void audit({
    action: "clinic.profissional_salvo",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_professional",
    resourceId: salvo.id,
    requestId,
    metadata: { user_id: ficha.user_id, especialidades: specialty_ids.length, ativo: ficha.is_active },
  });
  return ok(paraResposta(completo as LinhaDoBanco), { requestId });
}
