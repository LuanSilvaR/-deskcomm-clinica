/**
 * POST /api/v1/clinic/pops/versoes/:id/aprovar — FORK clinic (9015): aprova o
 * rascunho; a vigente anterior vira SUBSTITUÍDA na mesma transação.
 * `pops.aprovar` (separada de editar; conferida de novo por fn_pop_aprovar).
 * `lock_version` opcional: aprova exatamente o que a pessoa leu.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { falhaDoPop } from "@/lib/clinic/pops/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({ lock_version: z.number().int().min(1).nullish() }).strict();

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("pops.aprovar", { requestId, resource: "clinic_pop_versions" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });
  const lido = corpoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Pedido inválido."), 422, { requestId });

  const supabase = await createClient();
  const { data: v } = await supabase
    .from("clinic_pop_versions")
    .select("id, pop_id, major, minor")
    .eq("organization_id", authz.org.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!v) return fail("not_found", t("POP não encontrado."), 404, { requestId });

  const { data, error } = await supabase.rpc("fn_pop_aprovar", { p_versao: id, p_lock: lido.data.lock_version ?? null });
  if (error) return falhaDoPop(error, requestId, t);
  const r = data as { versao_id: string; substituida_id: string | null };
  const versao = v as { pop_id: string; major: number; minor: number };

  void audit({
    action: "clinic.pop_aprovado",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_pop_version",
    resourceId: id,
    requestId,
    metadata: { pop: versao.pop_id, versao: `${versao.major}.${versao.minor}`, substituida: r.substituida_id },
  });
  return ok(r, { requestId });
}
