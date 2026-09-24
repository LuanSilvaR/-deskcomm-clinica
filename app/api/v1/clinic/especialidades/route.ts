/**
 * /api/v1/clinic/especialidades — as especialidades da clínica.
 *
 * GET (viewer): todas, ativas primeiro. POST/PATCH (manager). Não há DELETE:
 * especialidade em uso é DESATIVADA (`is_active=false`), e deixa de habilitar
 * profissionais e de ser exigida pelos tipos (lib/clinic/profissionais/habilitacao.ts).
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

const COLUNAS = "id, name, color, is_active, created_at";
const COR = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB)");
const MSG_CONFLITO = "Já existe uma especialidade com esse nome.";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("profissionais.ver", { requestId, resource: "clinic_specialties" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_specialties")
    .select(COLUNAS)
    .eq("organization_id", authz.org.orgId)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true })
    .limit(500);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok(data ?? [], { requestId });
}

const criarSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(80, "Nome muito longo."),
  color: COR.nullish(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("profissionais.gerenciar", { requestId, resource: "clinic_specialties" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = criarSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "corpo inválido"), 422, { requestId });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_specialties")
    .insert({ organization_id: authz.org.orgId, name: lido.data.name, color: lido.data.color ?? null })
    .select(COLUNAS)
    .single();
  if (error) return falhaDoBanco(error, requestId, t, { conflito: MSG_CONFLITO });

  void audit({
    action: "clinic.especialidade_criada",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_specialty",
    resourceId: data.id,
    requestId,
    metadata: { name: lido.data.name },
  });
  return ok(data, { requestId, status: 201 });
}

const alterarSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1, "Informe o nome.").max(80, "Nome muito longo.").optional(),
    color: COR.nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.color !== undefined || v.is_active !== undefined, {
    message: "Nada para alterar.",
  });

export async function PATCH(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("profissionais.gerenciar", { requestId, resource: "clinic_specialties" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = alterarSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return fail("validation_failed", t(lido.error.issues[0]?.message ?? "corpo inválido"), 422, { requestId });
  }
  const { id, ...mudancas } = lido.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_specialties")
    .update(mudancas)
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select(COLUNAS)
    .maybeSingle();
  if (error) return falhaDoBanco(error, requestId, t, { conflito: MSG_CONFLITO });
  if (!data) return fail("not_found", t("Especialidade não encontrada."), 404, { requestId });

  void audit({
    action: "clinic.especialidade_alterada",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_specialty",
    resourceId: data.id,
    requestId,
    metadata: { campos: Object.keys(mudancas) },
  });
  return ok(data, { requestId });
}
