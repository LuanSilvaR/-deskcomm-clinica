/**
 * FORK (card #159) — a porta das rotas de /api/v1/admin/cobranca.
 *
 * Mesmo desenho do POST de /api/v1/admin/tenants (o fork não tem o
 * `requirePlatformAdminEscrita` do upstream): admin de plataforma ativo
 * (`getUser()` + `platform_admins`), escopo `full` para escrever, MFA em dia,
 * e 404 com o módulo `cobranca` desligado — desligado, a cobrança não existe.
 */
import { fail } from "@/lib/api/wrappers";
import { mfaEmDividaEstrita } from "@/lib/auth/server";
import { requirePlatformAdmin, type PlatformAdminContext } from "@/lib/auth/requirePlatformAdmin";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
export type Guarda = { ok: true; ctx: PlatformAdminContext; admin: Admin } | { ok: false; resposta: Response };

export async function guardaDaCobranca(requestId: string, escrita: boolean): Promise<Guarda> {
  let ctx: PlatformAdminContext;
  try {
    ctx = await requirePlatformAdmin();
  } catch {
    return { ok: false, resposta: fail("forbidden", "Platform admin required", 403, { requestId }) };
  }
  if (escrita) {
    if (ctx.platformAdmin.scope !== "full") {
      return {
        ok: false,
        resposta: fail("forbidden", "Seu acesso de suporte não permite mudar a cobrança", 403, { requestId }),
      };
    }
    if (await mfaEmDividaEstrita()) {
      return {
        ok: false,
        resposta: fail("mfa_required", "Confirme a verificação em duas etapas", 403, { requestId }),
      };
    }
  }
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "cobranca"))) {
    return { ok: false, resposta: fail("not_found", "Not found", 404, { requestId }) };
  }
  return { ok: true, ctx, admin };
}
