/**
 * PUT /api/v1/clinic/estoque/produtos/:productId — FORK clinic (estoque E0).
 *
 * Configura o produto para o estoque: EAN, NCM, ANVISA, unidades e fator,
 * rastreado (exige lote), controlado (conselhos que podem usar), mínimo e
 * ponto de pedido. O produto em si continua no cadastro de produtos.
 * `estoque.configurar`; a função confere empresa, opção e versão.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { produtoEstoqueSchema } from "@/lib/clinic/estoque/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ productId: string }> };

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.configurar", {
    requestId,
    resource: "clinic_produto_estoque",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { productId } = await ctx.params;
  if (!z.string().uuid().safeParse(productId).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = produtoEstoqueSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const { versao, ...dados } = lido.data;
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_produto_salvar", {
    p_org: org,
    p_product: productId,
    p_dados: dados,
    p_versao_esperada: versao ?? null,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.estoque_produto_configurado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "catalog_product",
    resourceId: productId,
    requestId,
    metadata: { rastreado: dados.rastreado, controlado: dados.controlado },
  });
  return ok(data as { id: string; versao: number }, { requestId });
}
