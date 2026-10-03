/**
 * GET /api/v1/clinic/estoque/nfe/:id — FORK clinic (estoque E5).
 *
 * A nota com os itens (dados do XML + sugestão/conferência) e o que a tela de
 * conferência precisa para escolher: produtos ativos (com unidade, fator e se
 * é rastreado), locais e — só para quem pode lançar no financeiro — as contas
 * financeiras ativas. `estoque.ver`.
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
  const authz = await requirePermission("estoque.ver", { requestId, resource: "clinic_estoque_nfe" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data: nota } = await supabase
    .from("clinic_estoque_nfe")
    .select("id, chave, numero, serie, emissao, emitente_cnpj, emitente_nome, destinatario_cnpj, total_cents, status, motivo, financial_entry_id, lancada_em, created_at")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!nota) return fail("not_found", t("NF-e não encontrada."), 404, { requestId });
  const podeFinanceiro = authz.permissoes.has("financeiro.lancar");
  const [itens, produtos, configs, locais, contas] = await Promise.all([
    supabase
      .from("clinic_estoque_nfe_itens")
      .select("id, numero, codigo, descricao, ean, ncm, unidade, quantidade, custo_total_cents, registro_anvisa, rastro, product_id, origem_casamento, fator, lote, validade, ignorado, conferido, operacao_id")
      .eq("organization_id", org)
      .eq("nfe_id", id)
      .order("numero"),
    supabase.from("catalog_products").select("id, nome").eq("organization_id", org).eq("ativo", true).order("nome").limit(2000),
    supabase.from("clinic_produto_estoque").select("product_id, unidade_estoque, unidade_aplicacao, fator_conversao, rastreado").eq("organization_id", org),
    supabase.from("clinic_estoque_locais").select("id, nome, padrao").eq("organization_id", org).eq("ativo", true).order("padrao", { ascending: false }),
    podeFinanceiro
      ? supabase.from("financial_accounts").select("id, name").eq("organization_id", org).eq("is_active", true).order("name")
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);
  const cfg = new Map(
    ((configs.data ?? []) as Array<{ product_id: string; unidade_estoque: string; unidade_aplicacao: string; fator_conversao: number | string; rastreado: boolean }>).map(
      (c) => [c.product_id, c],
    ),
  );
  return ok(
    {
      nota,
      itens: ((itens.data ?? []) as Array<Record<string, unknown>>).map((i) => ({
        ...i,
        quantidade: Number(i.quantidade),
        fator: i.fator === null ? null : Number(i.fator),
      })),
      produtos: ((produtos.data ?? []) as Array<{ id: string; nome: string }>).map((p) => {
        const c = cfg.get(p.id);
        return {
          id: p.id,
          nome: p.nome,
          unidade_estoque: c?.unidade_estoque ?? null,
          unidade_aplicacao: c?.unidade_aplicacao ?? null,
          fator: c ? Number(c.fator_conversao) : null,
          rastreado: c?.rastreado ?? false,
        };
      }),
      locais: locais.data ?? [],
      contas: ((contas.data ?? []) as Array<{ id: string; name: string }>).map((c) => ({ id: c.id, nome: c.name })),
      pode: { comprar: authz.permissoes.has("estoque.compras"), financeiro: podeFinanceiro },
    },
    { requestId },
  );
}
