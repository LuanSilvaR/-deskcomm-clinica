/**
 * /api/v1/clinic/acesso/papeis/:id — FORK clinic (ACL-006).
 *
 * PATCH (papeis.gerenciar): `{ nome, descricao?, ativo?, permissoes[] }` —
 *   substitui a lista inteira; o audit registra o que entrou e o que saiu.
 * DELETE (papeis.gerenciar): só papel criado pela empresa e sem membros.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { falhaDeAcesso } from "@/lib/clinic/acesso/erros-do-banco";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

import { papelSchema } from "@/lib/clinic/acesso/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("papeis.gerenciar", { requestId, resource: "clinic_roles" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido."), 422, { requestId });

  const lido = papelSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_acesso_salvar_papel", {
    p_org: authz.org.orgId,
    p_id: id,
    p_nome: lido.data.nome,
    p_descricao: lido.data.descricao ?? null,
    p_ativo: lido.data.ativo ?? true,
    p_permissoes: lido.data.permissoes,
  });
  if (error) return falhaDeAcesso(error, requestId, authz.user.idioma);
  const r = data as { id: string; adicionadas: string[]; removidas: string[] };
  void audit({
    action: "acesso.papel_alterado",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_role",
    resourceId: id,
    requestId,
    metadata: {
      nome: lido.data.nome,
      ativo: lido.data.ativo ?? true,
      permissoes_concedidas: r.adicionadas,
      permissoes_revogadas: r.removidas,
    },
  });
  return ok({ id, adicionadas: r.adicionadas, removidas: r.removidas }, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("papeis.gerenciar", { requestId, resource: "clinic_roles" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido."), 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_acesso_excluir_papel", { p_org: authz.org.orgId, p_id: id });
  if (error) return falhaDeAcesso(error, requestId, authz.user.idioma);
  void audit({
    action: "acesso.papel_excluido",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_role",
    resourceId: id,
    requestId,
    metadata: { nome: (data as { nome: string }).nome },
  });
  return ok({ id }, { requestId });
}
