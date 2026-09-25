/**
 * POST /api/v1/clinic/pops/:popId/versoes — FORK clinic (9015): nova versão a
 * partir da vigente (1.0 → 1.1; `maior` → 2.0), em rascunho, com o motivo.
 * `pops.editar` (conferido de novo por fn_pop_nova_versao).
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

const corpoSchema = z.object({ maior: z.boolean().default(false), motivo: z.string().trim().max(500).nullish() }).strict();

type Ctx = { params: Promise<{ popId: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("pops.editar", { requestId, resource: "clinic_pop_versions" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { popId } = await ctx.params;
  if (!z.string().uuid().safeParse(popId).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const lido = corpoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("O motivo da revisão tem no máximo 500 caracteres."), 422, { requestId });

  const supabase = await createClient();
  const { data: pop } = await supabase.from("clinic_pops").select("id, code").eq("organization_id", authz.org.orgId).eq("id", popId).maybeSingle();
  if (!pop) return fail("not_found", t("POP não encontrado."), 404, { requestId });

  const { data, error } = await supabase.rpc("fn_pop_nova_versao", { p_pop: popId, p_maior: lido.data.maior, p_motivo: lido.data.motivo ?? null });
  if (error) return falhaDoPop(error, requestId, t);
  const r = data as { versao_id: string; major: number; minor: number };

  void audit({
    action: "clinic.pop_nova_versao",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "clinic_pop_version",
    resourceId: r.versao_id,
    requestId,
    metadata: { pop: popId, codigo: (pop as { code: string }).code, versao: `${r.major}.${r.minor}`, motivo: lido.data.motivo ?? null },
  });
  return ok(r, { requestId, status: 201 });
}
