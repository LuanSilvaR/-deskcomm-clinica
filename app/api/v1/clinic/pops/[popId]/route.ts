/**
 * GET /api/v1/clinic/pops/:popId — FORK clinic (9015): o POP com TODAS as
 * versões (sem o conteúdo — ele vem por versão) e os nomes de quem criou,
 * alterou e aprovou. `pops.ver`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { COLUNAS_DA_VERSAO, nomesDosMembros, type VersaoDoPop } from "@/lib/clinic/pops/servidor";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ popId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("pops.ver", { requestId, resource: "clinic_pops" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { popId } = await ctx.params;
  if (!z.string().uuid().safeParse(popId).success) return fail("validation_failed", "id inválido", 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const [{ data: pop, error: e1 }, { data: versoes, error: e2 }] = await Promise.all([
    supabase.from("clinic_pops").select("id, procedure_id, code, created_at, created_by").eq("organization_id", org).eq("id", popId).maybeSingle(),
    supabase.from("clinic_pop_versions").select(COLUNAS_DA_VERSAO).eq("organization_id", org).eq("pop_id", popId).order("major", { ascending: false }).order("minor", { ascending: false }),
  ]);
  if (e1 || e2) return fail("internal_error", (e1 ?? e2)!.message, 500, { requestId });
  if (!pop) return fail("not_found", t("POP não encontrado."), 404, { requestId });

  const lista = (versoes ?? []) as VersaoDoPop[];
  const nomes = await nomesDosMembros(
    org,
    lista.flatMap((v) => [v.created_by, v.updated_by, v.approved_by]),
  );
  return ok({ pop, versoes: lista, nomes }, { requestId });
}
