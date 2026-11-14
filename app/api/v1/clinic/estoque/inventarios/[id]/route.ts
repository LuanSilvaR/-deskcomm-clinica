/**
 * GET /api/v1/clinic/estoque/inventarios/:id — FORK clinic (estoque E6).
 *
 * O inventário com os itens (produto, lote, validade, saldo fotografado e
 * contado). `estoque.ver`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.ver", { requestId, resource: "clinic_estoque_inventarios" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("clinic_estoque_inventarios")
    .select("id, local_id, status, motivo, created_at, fechado_em")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!inv) return fail("not_found", t("Inventário não encontrado."), 404, { requestId });
  const { data: itens } = await supabase
    .from("clinic_estoque_inventario_itens")
    .select("id, product_id, lote_id, quantidade_sistema, contado")
    .eq("organization_id", org)
    .eq("inventario_id", id);
  const lista = (itens ?? []) as Array<{ id: string; product_id: string; lote_id: string; quantidade_sistema: number | string; contado: number | string | null }>;
  const [produtos, lotes, configs] = await Promise.all([
    supabase.from("catalog_products").select("id, nome").eq("organization_id", org).in("id", [...new Set(lista.map((i) => i.product_id))]),
    supabase.from("clinic_estoque_lotes").select("id, codigo, validade").eq("organization_id", org).in("id", lista.map((i) => i.lote_id)),
    supabase.from("clinic_produto_estoque").select("product_id, unidade_aplicacao").eq("organization_id", org),
  ]);
  const nome = new Map(((produtos.data ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]));
  const lote = new Map(((lotes.data ?? []) as Array<{ id: string; codigo: string | null; validade: string | null }>).map((l) => [l.id, l]));
  const unidade = new Map(((configs.data ?? []) as Array<{ product_id: string; unidade_aplicacao: string }>).map((c) => [c.product_id, c.unidade_aplicacao]));
  return ok(
    {
      inventario: inv,
      itens: lista
        .map((i) => ({
          id: i.id,
          produto: nome.get(i.product_id) ?? "",
          unidade: unidade.get(i.product_id) ?? "un",
          lote: lote.get(i.lote_id)?.codigo ?? null,
          validade: lote.get(i.lote_id)?.validade ?? null,
          quantidade_sistema: Number(i.quantidade_sistema),
          contado: i.contado === null ? null : Number(i.contado),
        }))
        .sort((a, b) => a.produto.localeCompare(b.produto) || (a.validade ?? "9").localeCompare(b.validade ?? "9")),
    },
    { requestId },
  );
}
