/**
 * GET /api/v1/clinic/estoque/alertas — FORK clinic (estoque E7).
 *
 * Os alertas abertos (a varredura de hora em hora os mantém em dia), com o
 * nome do produto e o código do lote. Sem dado de paciente. `estoque.ver`.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Linha {
  id: string;
  tipo: string;
  product_id: string | null;
  lote_id: string | null;
  frasco_id: string | null;
  detalhe: Record<string, unknown>;
  aberto_em: string;
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.ver", { requestId, resource: "clinic_estoque_alertas" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_estoque_alertas")
    .select("id, tipo, product_id, lote_id, frasco_id, detalhe, aberto_em")
    .eq("organization_id", org)
    .eq("status", "aberto")
    .order("aberto_em", { ascending: false })
    .limit(300);
  if (error) return fail("internal_error", t("Não foi possível ler os alertas."), 500, { requestId });
  const linhas = (data ?? []) as Linha[];
  const produtos = [...new Set(linhas.map((l) => l.product_id).filter((x): x is string => Boolean(x)))];
  const lotes = [...new Set(linhas.map((l) => l.lote_id).filter((x): x is string => Boolean(x)))];
  const [p, l] = await Promise.all([
    produtos.length
      ? supabase.from("catalog_products").select("id, nome").eq("organization_id", org).in("id", produtos)
      : Promise.resolve({ data: [] }),
    lotes.length
      ? supabase.from("clinic_estoque_lotes").select("id, codigo").eq("organization_id", org).in("id", lotes)
      : Promise.resolve({ data: [] }),
  ]);
  const nome = new Map(((p.data ?? []) as Array<{ id: string; nome: string }>).map((x) => [x.id, x.nome]));
  const codigo = new Map(((l.data ?? []) as Array<{ id: string; codigo: string | null }>).map((x) => [x.id, x.codigo]));
  return ok(
    {
      alertas: linhas.map((a) => ({
        ...a,
        produto: a.product_id ? (nome.get(a.product_id) ?? "") : null,
        lote: a.lote_id ? (codigo.get(a.lote_id) ?? null) : null,
      })),
      pode_movimentar: authz.permissoes.has("estoque.movimentar"),
    },
    { requestId },
  );
}
