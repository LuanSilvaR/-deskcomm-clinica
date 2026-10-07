/**
 * GET /api/v1/clinic/estoque/posicao — FORK clinic (estoque E0).
 *
 * A posição de estoque: locais e, por produto, os lotes com o saldo de cada um
 * em cada local (saldo = soma dos movimentos). `?produto=<id>` restringe a um
 * produto (ficha). Custo do lote só para quem tem `estoque.custos`. Com a opção
 * desligada responde `ligado: false` (a tela explica como ligar).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { lerPosicao } from "@/lib/clinic/estoque/posicao";
import { estoqueLigado } from "@/lib/clinic/flags";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.ver", {
    requestId,
    resource: "clinic_estoque_movimentos",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const produto = req.nextUrl.searchParams.get("produto");
  if (produto && !z.string().uuid().safeParse(produto).success) {
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  }
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data: empresa } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", org)
    .maybeSingle();
  const pode = {
    movimentar: authz.permissoes.has("estoque.movimentar"),
    inventariar: authz.permissoes.has("estoque.inventariar"),
    configurar: authz.permissoes.has("estoque.configurar"),
    estornar: authz.permissoes.has("estoque.estornar"),
    custos: authz.permissoes.has("estoque.custos"),
    compras: authz.permissoes.has("estoque.compras"),
  };
  if (!estoqueLigado((empresa as { settings?: unknown } | null)?.settings)) {
    return ok({ ligado: false, locais: [], produtos: [], pode }, { requestId });
  }
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    const posicao = await lerPosicao(supabase, org, {
      hoje,
      verCustos: pode.custos,
      productId: produto ?? undefined,
    });
    return ok({ ligado: true, ...posicao, pode }, { requestId });
  } catch {
    return fail("internal_error", t("Não foi possível ler o estoque."), 500, { requestId });
  }
}
