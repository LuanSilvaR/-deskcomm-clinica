/**
 * /api/v1/clinic/pops/versoes/:id — FORK clinic (9015): uma versão do POP.
 *
 * GET (`pops.ver`): metadados + conteúdo + nomes.
 * PATCH (`pops.editar`): `{ content, lock_version }` — só RASCUNHO. O conteúdo é
 *   validado (lista fechada de nós, sem HTML); a trava otimista recusa com 409
 *   se outra pessoa salvou antes (o banco sobe o lock_version a cada gravação).
 * DELETE (`pops.editar`): descarta o RASCUNHO (aprovada não se apaga).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { textoPuro, validarDocumento } from "@/lib/clinic/pops/documento";
import { COLUNAS_DA_VERSAO, falhaDoPop, nomesDosMembros, type VersaoDoPop } from "@/lib/clinic/pops/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Autosave grava muito: a auditoria do rascunho registra no máximo 1 vez a cada 15 min. */
const INTERVALO_DA_AUDITORIA_MS = 15 * 60_000;

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("pops.ver", { requestId, resource: "clinic_pop_versions" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_pop_versions")
    .select(`${COLUNAS_DA_VERSAO}, content`)
    .eq("organization_id", authz.org.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", t("POP não encontrado."), 404, { requestId });
  const v = data as VersaoDoPop & { content: unknown };
  const nomes = await nomesDosMembros(authz.org.orgId, [v.created_by, v.updated_by, v.approved_by]);
  return ok({ versao: v, nomes }, { requestId });
}

const patchSchema = z.object({ content: z.unknown(), lock_version: z.number().int().min(1) }).strict();

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("pops.editar", { requestId, resource: "clinic_pop_versions" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const lido = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Conteúdo inválido."), 422, { requestId });
  const doc = validarDocumento(lido.data.content);
  if (!doc.ok) return fail("validation_failed", t(doc.motivo), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("clinic_pop_versions")
    .select("id, status, lock_version, updated_at, updated_by, pop_id, major, minor")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!atual) return fail("not_found", t("POP não encontrado."), 404, { requestId });
  const a = atual as { status: string; lock_version: number; updated_at: string; updated_by: string | null; pop_id: string; major: number; minor: number };
  if (a.status !== "draft") {
    return fail("pop_versao_imutavel", t("Esta versão já foi aprovada e não pode ser alterada. Crie uma nova versão."), 409, { requestId });
  }
  if (a.lock_version !== lido.data.lock_version) {
    const nomes = await nomesDosMembros(org, [a.updated_by]);
    return fail("pop_editado_por_outra_pessoa", t("Outra pessoa alterou este rascunho. Recarregue para ver a versão atual."), 409, {
      requestId,
      details: { atualizado_em: a.updated_at, atualizado_por: a.updated_by ? (nomes[a.updated_by] ?? null) : null, lock_version: a.lock_version },
    });
  }

  const { data, error } = await supabase
    .from("clinic_pop_versions")
    .update({ content: doc.documento, content_text: textoPuro(doc.documento) })
    .eq("organization_id", org)
    .eq("id", id)
    .eq("status", "draft")
    .eq("lock_version", lido.data.lock_version)
    .select(COLUNAS_DA_VERSAO)
    .maybeSingle();
  if (error) return falhaDoPop(error, requestId, t);
  if (!data) {
    return fail("pop_editado_por_outra_pessoa", t("Outra pessoa alterou este rascunho. Recarregue para ver a versão atual."), 409, { requestId });
  }

  if (Date.now() - Date.parse(a.updated_at) >= INTERVALO_DA_AUDITORIA_MS) {
    void audit({
      action: "clinic.pop_rascunho_alterado",
      actorUserId: authz.user.id,
      organizationId: org,
      resourceType: "clinic_pop_version",
      resourceId: id,
      requestId,
      metadata: { pop: a.pop_id, versao: `${a.major}.${a.minor}` },
    });
  }
  return ok(data as VersaoDoPop, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("pops.editar", { requestId, resource: "clinic_pop_versions" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_pop_versions")
    .delete()
    .eq("organization_id", authz.org.orgId)
    .eq("id", id)
    .eq("status", "draft")
    .select("id, pop_id, major, minor")
    .maybeSingle();
  if (error) return falhaDoPop(error, requestId, t);
  if (!data) return fail("not_found", t("Não há rascunho para descartar."), 404, { requestId });
  const v = data as { pop_id: string; major: number; minor: number };

  void audit({
    action: "clinic.pop_rascunho_descartado",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_pop_version",
    resourceId: id,
    requestId,
    metadata: { pop: v.pop_id, versao: `${v.major}.${v.minor}` },
  });
  return ok({ id }, { requestId });
}
