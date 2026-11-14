/**
 * GET /api/v1/clinic/estoque/pendencias — FORK clinic (estoque E2).
 *
 * O que a baixa pelo prontuário não conseguiu tirar do estoque (sem saldo,
 * lote desconhecido, sem local) e os controlados usados por profissional fora
 * dos conselhos permitidos. `?status=aberta` (padrão) ou `todas`. Só ids,
 * produto, quantidade e motivo — nada do paciente. `estoque.ver`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Linha {
  id: string;
  product_id: string;
  quantidade: number | string;
  lote_informado: string | null;
  motivo: string;
  status: string;
  resolucao: string | null;
  resolvida_em: string | null;
  created_at: string;
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.ver", {
    requestId,
    resource: "clinic_estoque_pendencias",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const todas = req.nextUrl.searchParams.get("status") === "todas";
  const org = authz.org.orgId;
  const supabase = await createClient();
  let q = supabase
    .from("clinic_estoque_pendencias")
    .select("id, product_id, quantidade, lote_informado, motivo, status, resolucao, resolvida_em, created_at")
    .eq("organization_id", org)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!todas) q = q.eq("status", "aberta");
  const { data, error } = await q;
  if (error) return fail("internal_error", t("Não foi possível ler as pendências."), 500, { requestId });
  const linhas = (data ?? []) as unknown as Linha[];
  const ids = [...new Set(linhas.map((l) => l.product_id))];
  const nomes = new Map<string, string>();
  if (ids.length > 0) {
    const { data: produtos } = await supabase
      .from("catalog_products")
      .select("id, nome")
      .eq("organization_id", org)
      .in("id", ids);
    for (const p of (produtos ?? []) as Array<{ id: string; nome: string }>) nomes.set(p.id, p.nome);
  }
  return ok(
    {
      pendencias: linhas.map((l) => ({
        ...l,
        quantidade: Number(l.quantidade),
        produto_nome: nomes.get(l.product_id) ?? "",
      })),
      pode_resolver: authz.permissoes.has("estoque.movimentar"),
    },
    { requestId },
  );
}
