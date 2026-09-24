/**
 * /api/v1/clinic/acesso/papeis — FORK clinic (ACL-006).
 *
 * GET (papeis.ver): os papéis da empresa, com as permissões e quantos membros.
 * POST (papeis.gerenciar): cria `{ nome, descricao?, permissoes[] }` — também é
 * o "duplicar" da tela (ela manda as permissões do papel de origem).
 *
 * A escrita vai SÓ por `fn_acesso_salvar_papel` (9010): lock, regra de
 * concessão, dependências e antitravamento moram no banco.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { falhaDeAcesso } from "@/lib/clinic/acesso/erros-do-banco";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { papelSchema } from "@/lib/clinic/acesso/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("papeis.ver", { requestId, resource: "clinic_roles" });
  if (!authz.ok) return authz.response;
  const org = authz.org.orgId;

  const supabase = await createClient();
  const [papeis, permissoes, membros] = await Promise.all([
    supabase.from("clinic_roles").select("id, nome, descricao, is_system, system_key, ativo").eq("organization_id", org).order("nome"),
    supabase.from("clinic_role_permissions").select("role_id, permission_key").eq("organization_id", org),
    supabase.from("clinic_member_roles").select("role_id").eq("organization_id", org),
  ]);
  const erro = papeis.error ?? permissoes.error ?? membros.error;
  if (erro) return fail("internal_error", erro.message, 500, { requestId });

  const chaves = new Map<string, string[]>();
  for (const p of (permissoes.data ?? []) as { role_id: string; permission_key: string }[]) {
    chaves.set(p.role_id, [...(chaves.get(p.role_id) ?? []), p.permission_key]);
  }
  const contagem = new Map<string, number>();
  for (const m of (membros.data ?? []) as { role_id: string }[]) contagem.set(m.role_id, (contagem.get(m.role_id) ?? 0) + 1);

  return ok(
    ((papeis.data ?? []) as { id: string }[]).map((p) => ({
      ...p,
      permissoes: (chaves.get(p.id) ?? []).sort(),
      membros: contagem.get(p.id) ?? 0,
    })),
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("papeis.gerenciar", { requestId, resource: "clinic_roles" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);

  const lido = papelSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_acesso_salvar_papel", {
    p_org: authz.org.orgId,
    p_id: null,
    p_nome: lido.data.nome,
    p_descricao: lido.data.descricao ?? null,
    p_ativo: lido.data.ativo ?? true,
    p_permissoes: lido.data.permissoes,
  });
  if (error) return falhaDeAcesso(error, requestId, authz.user.idioma);
  const r = data as { id: string; adicionadas: string[] };
  void audit({
    action: "acesso.papel_criado",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_role",
    resourceId: r.id,
    requestId,
    metadata: { nome: lido.data.nome, permissoes: r.adicionadas },
  });
  return ok({ id: r.id }, { requestId, status: 201 });
}
