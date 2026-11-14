/**
 * FORK clinic (ACL-004) — `requirePermission("agenda.cancelar")`.
 *
 * A pergunta passa a ser "o usuário TEM esta permissão?", não "qual o papel?".
 * Reaproveita a cadeia inteira de `requireRole` (sessão, suporte encerrado,
 * empresa ativa, MFA em dívida, audit `authz.denied`) com o piso `viewer` — e
 * só então pergunta ao banco as permissões EFETIVAS (`fn_member_permissions`,
 * migration 9009). Nada vem do JWT: revogar vale na requisição seguinte.
 *
 * Deny by default: chave fora do catálogo nunca passa (erro de programação →
 * 500, não 403, para aparecer no CI e no Sentry).
 */
import { fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole, type RoleCheck } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

import { ehPermissao, type ChaveDePermissao } from "./catalogo";
import { permissoesEfetivas } from "./resolver";

export type PermissionCheck =
  | (Extract<RoleCheck, { ok: true }> & { permissoes: ReadonlySet<string> })
  | Extract<RoleCheck, { ok: false }>;

interface Opcoes {
  requestId?: string;
  resource?: string;
  allowPlatformAdmin?: boolean;
  organizationId?: string;
}

export async function requirePermission(chave: ChaveDePermissao, opts: Opcoes = {}): Promise<PermissionCheck> {
  if (!ehPermissao(chave)) {
    return { ok: false, response: fail("internal_error", `Permissão desconhecida: ${chave}`, 500, { requestId: opts.requestId }) };
  }
  const base = await requireRole("viewer", opts);
  if (!base.ok) return base;

  // Plataforma autorizada pela rota (mesma regra de requireRole): não é membro
  // da empresa, então não tem papéis — a rota decidiu deixá-la passar.
  if (opts.allowPlatformAdmin && base.user.is_platform_admin && !base.user.support) {
    return { ...base, permissoes: new Set<string>() };
  }

  const supabase = await createClient();
  const efetivas = await permissoesEfetivas(supabase, base.org.orgId);
  if (!efetivas.ok) {
    return { ok: false, response: fail("internal_error", efetivas.erro, 500, { requestId: opts.requestId }) };
  }
  if (!efetivas.permissoes.has(chave)) {
    void audit({
      action: "authz.denied",
      actorUserId: base.user.id,
      organizationId: base.org.orgId,
      resourceType: opts.resource ?? null,
      requestId: opts.requestId,
      metadata: { required_permission: chave, effective_role: base.org.role },
    });
    return {
      ok: false,
      response: fail("forbidden_permission", traduzir("Você não tem permissão para esta ação.", base.user.idioma), 403, {
        requestId: opts.requestId,
        details: { permissao: chave },
      }),
    };
  }
  return { ...base, permissoes: efetivas.permissoes };
}
