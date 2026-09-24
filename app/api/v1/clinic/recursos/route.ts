/**
 * /api/v1/clinic/recursos — salas e equipamentos (migration 9007).
 *
 * GET (viewer): todos, ativos e desativados.
 * POST (manager): cria `{ name, category }`.
 * PATCH (manager): `{ id, name?, category?, is_active? }`. Não se apaga recurso:
 * desativar tira da oferta e da alocação, e o histórico das alocações fica.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { falhaDoBanco } from "@/lib/clinic/api";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLUNAS = "id, name, category, is_active";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "clinic_resources" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_resources")
    .select(COLUNAS)
    .eq("organization_id", authz.org.orgId)
    .order("category")
    .order("name");
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok(data ?? [], { requestId });
}

const nome = z.string().trim().min(1).max(80);
const categoria = z.string().trim().min(1).max(40);
const criarSchema = z.object({ name: nome, category: categoria });
const alterarSchema = z
  .object({ id: z.string().uuid(), name: nome.optional(), category: categoria.optional(), is_active: z.boolean().optional() })
  .refine((v) => v.name !== undefined || v.category !== undefined || v.is_active !== undefined, { message: "Nada para alterar." });

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "clinic_resources" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = criarSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Informe o nome e a categoria."), 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_resources")
    .insert({ organization_id: authz.org.orgId, name: lido.data.name, category: lido.data.category })
    .select(COLUNAS)
    .single();
  if (error) {
    if (error.code === "23505") return fail("conflict", t("Já existe uma sala ou equipamento com este nome."), 409, { requestId });
    return falhaDoBanco(error, requestId, t);
  }
  void audit({
    action: "clinic.recurso_salvo",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_resource",
    resourceId: (data as { id: string }).id,
    requestId,
    metadata: { criado: true, categoria: lido.data.category },
  });
  return ok(data, { requestId, status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "clinic_resources" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = alterarSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const { id, ...campos } = lido.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_resources")
    .update(campos)
    .eq("organization_id", authz.org.orgId)
    .eq("id", id)
    .select(COLUNAS)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return fail("conflict", t("Já existe uma sala ou equipamento com este nome."), 409, { requestId });
    return falhaDoBanco(error, requestId, t);
  }
  if (!data) return fail("not_found", t("Sala ou equipamento não encontrado."), 404, { requestId });
  void audit({
    action: "clinic.recurso_salvo",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_resource",
    resourceId: id,
    requestId,
    metadata: { campos: Object.keys(campos) },
  });
  return ok(data, { requestId });
}
