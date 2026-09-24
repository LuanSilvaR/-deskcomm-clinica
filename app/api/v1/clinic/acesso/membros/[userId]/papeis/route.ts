/**
 * PUT /api/v1/clinic/acesso/membros/:userId/papeis — FORK clinic (ACL-006).
 *
 * `{ papeis: [ids] }` substitui os papéis do membro (vários; vale a união).
 * `equipe.atribuir_papeis`; o banco (`fn_acesso_atribuir_papeis`, 9010) recusa
 * dar papel com permissão que o ator não tem e deixar a empresa sem
 * Administrador.
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

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

const corpoSchema = z.object({ papeis: z.array(z.string().uuid()).max(20) }).strict();

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("equipe.atribuir_papeis", { requestId, resource: "clinic_member_roles" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { userId } = await ctx.params;
  if (!z.string().uuid().safeParse(userId).success) return fail("validation_failed", t("id inválido."), 422, { requestId });

  const lido = corpoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_acesso_atribuir_papeis", {
    p_org: authz.org.orgId,
    p_user: userId,
    p_papeis: lido.data.papeis,
  });
  if (error) return falhaDeAcesso(error, requestId, authz.user.idioma);
  const r = data as { adicionados: string[]; removidos: string[] };
  void audit({
    action: "acesso.papeis_do_membro_alterados",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "user",
    resourceId: userId,
    requestId,
    metadata: { papeis_adicionados: r.adicionados, papeis_removidos: r.removidos },
  });
  return ok({ user_id: userId, papeis: lido.data.papeis }, { requestId });
}
