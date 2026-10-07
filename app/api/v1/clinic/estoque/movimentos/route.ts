/**
 * /api/v1/clinic/estoque/movimentos — FORK clinic (estoque E0).
 *
 * GET  (`estoque.ver`): o histórico, operação por operação (mais nova antes),
 *      com as linhas (produto, lote, local, quantidade com sinal). `?produto=`
 *      restringe a um produto; `?antes=<data ISO>` pagina.
 * POST: uma movimentação manual — `entrada`, `transferencia`, `perda` ou
 *      `ajuste`. A permissão depende da ação (movimentar / inventariar) e o
 *      banco confere de novo: empresa, opção ligada, lote vencido, saldo nunca
 *      negativo (com trava do lote).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { FUNCAO_DO_MOVIMENTO, movimentoSchema } from "@/lib/clinic/estoque/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LIMITE = 50;

interface LinhaCrua {
  operacao_id: string;
  product_id: string;
  lote_id: string;
  local_id: string;
  quantidade: number | string;
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.ver", {
    requestId,
    resource: "clinic_estoque_movimentos",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const params = z
    .object({
      produto: z.string().uuid().optional(),
      antes: z.string().datetime({ offset: true }).optional(),
    })
    .safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!params.success)
    return fail("validation_failed", t("Parâmetros inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();

  let opsQ = supabase
    .from("clinic_estoque_operacoes")
    .select("id, tipo, origem_tipo, motivo, estorna_operacao_id, created_at")
    .eq("organization_id", org)
    .order("created_at", { ascending: false })
    .limit(LIMITE + 1);
  if (params.data.antes) opsQ = opsQ.lt("created_at", params.data.antes);
  if (params.data.produto) {
    const { data: doProduto, error } = await supabase
      .from("clinic_estoque_movimentos")
      .select("operacao_id")
      .eq("organization_id", org)
      .eq("product_id", params.data.produto)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return fail("internal_error", error.message, 500, { requestId });
    const ids = [...new Set((doProduto ?? []).map((m) => m.operacao_id as string))];
    if (ids.length === 0) return ok({ operacoes: [], proximo: null }, { requestId });
    opsQ = opsQ.in("id", ids);
  }
  const { data: opsData, error: opsErr } = await opsQ;
  if (opsErr) return fail("internal_error", opsErr.message, 500, { requestId });
  const ops = (opsData ?? []).slice(0, LIMITE) as Array<{
    id: string;
    tipo: string;
    origem_tipo: string | null;
    motivo: string | null;
    estorna_operacao_id: string | null;
    created_at: string;
  }>;
  const ids = ops.map((o) => o.id);
  if (ids.length === 0) return ok({ operacoes: [], proximo: null }, { requestId });

  const [linhas, estornos] = await Promise.all([
    supabase
      .from("clinic_estoque_movimentos")
      .select("operacao_id, product_id, lote_id, local_id, quantidade")
      .eq("organization_id", org)
      .in("operacao_id", ids),
    supabase
      .from("clinic_estoque_operacoes")
      .select("estorna_operacao_id")
      .eq("organization_id", org)
      .in("estorna_operacao_id", ids),
  ]);
  if (linhas.error ?? estornos.error) {
    return fail("internal_error", (linhas.error ?? estornos.error)!.message, 500, { requestId });
  }
  const movs = (linhas.data ?? []) as LinhaCrua[];
  const [produtos, lotes, locais] = await Promise.all([
    supabase
      .from("catalog_products")
      .select("id, nome")
      .eq("organization_id", org)
      .in("id", [...new Set(movs.map((m) => m.product_id))]),
    supabase
      .from("clinic_estoque_lotes")
      .select("id, codigo, validade")
      .eq("organization_id", org)
      .in("id", [...new Set(movs.map((m) => m.lote_id))]),
    supabase.from("clinic_estoque_locais").select("id, nome").eq("organization_id", org),
  ]);
  const nomeDoProduto = new Map(
    (produtos.data ?? []).map((p) => [p.id as string, p.nome as string]),
  );
  const lote = new Map(
    (lotes.data ?? []).map((l) => [
      l.id as string,
      l as { codigo: string | null; validade: string | null },
    ]),
  );
  const nomeDoLocal = new Map((locais.data ?? []).map((l) => [l.id as string, l.nome as string]));
  const estornadas = new Set((estornos.data ?? []).map((e) => e.estorna_operacao_id as string));

  return ok(
    {
      operacoes: ops.map((o) => ({
        ...o,
        estornada: estornadas.has(o.id),
        linhas: movs
          .filter((m) => m.operacao_id === o.id)
          .map((m) => ({
            product_id: m.product_id,
            produto: nomeDoProduto.get(m.product_id) ?? null,
            lote_id: m.lote_id,
            lote: lote.get(m.lote_id)?.codigo ?? null,
            validade: lote.get(m.lote_id)?.validade ?? null,
            local_id: m.local_id,
            local: nomeDoLocal.get(m.local_id) ?? null,
            quantidade: Number(m.quantidade),
          })),
      })),
      proximo: (opsData ?? []).length > LIMITE ? ops.at(-1)!.created_at : null,
    },
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.ver", {
    requestId,
    resource: "clinic_estoque_movimentos",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = movimentoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const { acao, ...dados } = lido.data;
  const alvo = FUNCAO_DO_MOVIMENTO[acao];
  if (!authz.permissoes.has(alvo.permissao)) {
    return fail("forbidden_permission", t("Você não tem permissão para esta ação."), 403, {
      requestId,
    });
  }
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(alvo.rpc, { p_org: org, p_dados: dados });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { operacao_id: string | null; lote_id?: string; diferenca?: number };
  if (r.operacao_id) {
    void audit({
      action: "clinic.estoque_movimentado",
      actorUserId: authz.user.id,
      organizationId: org,
      resourceType: "clinic_estoque_operacao",
      resourceId: r.operacao_id,
      requestId,
      metadata: { acao },
    });
  }
  return ok(r, { requestId });
}
