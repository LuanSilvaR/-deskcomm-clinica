/**
 * /api/v1/clinic/procedimentos/:id/kit — FORK clinic (estoque E3).
 *
 * O kit do procedimento: o que ele costuma gastar (produto e quantidade na
 * unidade de aplicação). Pré-preenche os insumos no atendimento e reserva o
 * estoque. GET `procedimentos.ver`; PUT `procedimentos.gerenciar` (substitui a
 * lista; a função confere empresa, procedimento e produtos).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { kitSchema } from "@/lib/clinic/estoque/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("procedimentos.ver", { requestId, resource: "clinic_procedimento_kits" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const [kit, produtos, configs] = await Promise.all([
    supabase.from("clinic_procedimento_kits").select("product_id, quantidade").eq("organization_id", org).eq("procedure_id", id),
    supabase.from("catalog_products").select("id, nome").eq("organization_id", org).eq("ativo", true).order("nome").limit(500),
    supabase.from("clinic_produto_estoque").select("product_id, unidade_aplicacao").eq("organization_id", org),
  ]);
  const falha = kit.error ?? produtos.error;
  if (falha) return fail("internal_error", t("Não foi possível ler o kit."), 500, { requestId });
  // Sem estoque.ver as unidades não vêm (RLS): a tela mostra a quantidade sem unidade.
  const unidade = new Map(
    ((configs.data ?? []) as Array<{ product_id: string; unidade_aplicacao: string }>).map((c) => [c.product_id, c.unidade_aplicacao]),
  );
  return ok(
    {
      itens: ((kit.data ?? []) as Array<{ product_id: string; quantidade: number | string }>).map((k) => ({
        product_id: k.product_id,
        quantidade: Number(k.quantidade),
        unidade: unidade.get(k.product_id) ?? null,
      })),
      produtos: ((produtos.data ?? []) as Array<{ id: string; nome: string }>).map((p) => ({
        id: p.id,
        nome: p.nome,
        unidade: unidade.get(p.id) ?? null,
      })),
    },
    { requestId },
  );
}

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("procedimentos.gerenciar", { requestId, resource: "clinic_procedimento_kits" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = kitSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_kit_salvar", {
    p_org: org,
    p_procedure: id,
    p_itens: lido.data.itens,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: "clinic.estoque_kit_salvo",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_procedure",
    resourceId: id,
    requestId,
    metadata: { numero: lido.data.itens.length },
  });
  return ok(data as { itens: number }, { requestId });
}
