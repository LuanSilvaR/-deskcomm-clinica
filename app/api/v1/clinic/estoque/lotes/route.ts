/**
 * GET /api/v1/clinic/estoque/lotes — FORK clinic (estoque E8).
 *
 * Todos os lotes com código (inclusive os já zerados — o recall precisa
 * deles), com produto e validade, mais recentes primeiro. `estoque.ver`.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.ver", { requestId, resource: "clinic_estoque_lotes" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_estoque_lotes")
    .select("id, product_id, codigo, validade, created_at")
    .eq("organization_id", org)
    .not("codigo", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return fail("internal_error", t("Não foi possível ler os lotes."), 500, { requestId });
  const linhas = (data ?? []) as Array<{ id: string; product_id: string; codigo: string; validade: string | null }>;
  const ids = [...new Set(linhas.map((l) => l.product_id))];
  const { data: produtos } = ids.length
    ? await supabase.from("catalog_products").select("id, nome").eq("organization_id", org).in("id", ids)
    : { data: [] };
  const nome = new Map(((produtos ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]));
  return ok(
    { lotes: linhas.map((l) => ({ id: l.id, codigo: l.codigo, validade: l.validade, produto: nome.get(l.product_id) ?? "" })) },
    { requestId },
  );
}
