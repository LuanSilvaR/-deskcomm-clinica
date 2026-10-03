/**
 * GET /api/v1/clinic/estoque/relatorios/compra — FORK clinic (estoque E8).
 *
 * Sugestão de compra: produtos no ponto de pedido ou abaixo do mínimo e
 * quanto comprar (em unidade de estoque) para voltar ao dobro do nível de
 * alerta. `estoque.ver`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const query = z.object({});

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.ver", { requestId, resource: "clinic_estoque_movimentos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!lido.success) return fail("validation_failed", t("Parâmetros inválidos."), 422, { requestId });
  const supabase = await createClient();
  const { data: linhas, error } = await supabase.rpc("fn_clinic_estoque_rel_compra", {
    p_org: authz.org.orgId,

  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  return ok({ linhas: linhas ?? [] }, { requestId });
}
