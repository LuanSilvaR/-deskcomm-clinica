/**
 * GET /api/v1/clinic/acesso/membros — FORK clinic (ACL-006).
 *
 * Os papéis de cada membro ativo da empresa (`{ user_id, papeis: [ids] }`).
 * Nome e e-mail vêm da tela de Equipe (`/api/v1/team`), que já os resolve —
 * aqui não se repete a leitura de auth. A partir de `equipe.ver`.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("equipe.ver", { requestId, resource: "clinic_member_roles" });
  if (!authz.ok) return authz.response;
  const org = authz.org.orgId;

  const supabase = await createClient();
  const [vinculos, atribuicoes] = await Promise.all([
    supabase.from("user_organizations").select("user_id, role").eq("organization_id", org).is("revoked_at", null),
    supabase.from("clinic_member_roles").select("user_id, role_id").eq("organization_id", org),
  ]);
  const erro = vinculos.error ?? atribuicoes.error;
  if (erro) return fail("internal_error", erro.message, 500, { requestId });

  const por = new Map<string, string[]>();
  for (const a of (atribuicoes.data ?? []) as { user_id: string; role_id: string }[]) {
    por.set(a.user_id, [...(por.get(a.user_id) ?? []), a.role_id]);
  }
  return ok(
    ((vinculos.data ?? []) as { user_id: string; role: string }[]).map((v) => ({
      user_id: v.user_id,
      nivel_legado: v.role,
      papeis: por.get(v.user_id) ?? [],
    })),
    { requestId },
  );
}
