/**
 * GET /api/v1/clinic/acesso/eu — FORK clinic (ACL-007).
 *
 * As permissões EFETIVAS de quem está logado na empresa ativa e se o modo por
 * permissões está ligado. É o que o front usa para `can()` — só UX: quem decide
 * é o backend e a RLS. Qualquer membro (piso viewer).
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { permissoesEfetivas } from "@/lib/clinic/acesso/resolver";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "clinic_roles" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const [efetivas, modo] = await Promise.all([
    permissoesEfetivas(supabase, authz.org.orgId),
    supabase.rpc("fn_acesso_modo_ligado", { p_org: authz.org.orgId }),
  ]);
  if (!efetivas.ok) return fail("internal_error", efetivas.erro, 500, { requestId });
  return ok({ modo_ligado: modo.data === true, permissoes: [...efetivas.permissoes].sort() }, { requestId });
}
