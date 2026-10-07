/**
 * GET /api/v1/clinic/procedimentos/opcoes — o que a seção Procedimentos do
 * atendimento oferece para escolher (FORK clinic, prontuário F5): o catálogo de
 * procedimentos ativos (9015) e os produtos ativos. Sem dado de paciente.
 *
 * Estoque E3 (aditivo): `kits` (procedimento → produtos e quantidades, para
 * pré-preencher os insumos) e, com o estoque ligado, `estoque` (produto →
 * disponível já descontadas as reservas, unidade e lote que sai primeiro).
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("atendimento.registrar", { requestId, resource: "clinic_procedures" });
  if (!authz.ok) return authz.response;
  const org = authz.org.orgId;
  const supabase = await createClient();
  const [procs, produtos, kits, estoque] = await Promise.all([
    supabase.from("clinic_procedures").select("id, name").eq("organization_id", org).eq("is_active", true).order("name"),
    supabase.from("catalog_products").select("id, nome, codigo").eq("organization_id", org).eq("ativo", true).order("nome").limit(500),
    supabase.from("clinic_procedimento_kits").select("procedure_id, product_id, quantidade").eq("organization_id", org),
    supabase.rpc("fn_clinic_estoque_disponibilidade", { p_org: org }),
  ]);
  const erro = procs.error ?? produtos.error;
  if (erro) return fail("internal_error", erro.message, 500, { requestId });
  const porProcedimento: Record<string, Array<{ product_id: string; quantidade: number }>> = {};
  for (const k of (kits.data ?? []) as Array<{ procedure_id: string; product_id: string; quantidade: number | string }>) {
    (porProcedimento[k.procedure_id] ??= []).push({ product_id: k.product_id, quantidade: Number(k.quantidade) });
  }
  // Estoque é informação de apoio: se a leitura falhar, a tela segue sem ele.
  const disponivel = estoque.error
    ? null
    : ((estoque.data ?? null) as Array<{
        product_id: string;
        unidade: string;
        disponivel: number;
        lote: string | null;
        validade: string | null;
      }> | null);
  return ok(
    {
      procedimentos: (procs.data ?? []).map((p) => ({ id: p.id as string, nome: p.name as string })),
      produtos: (produtos.data ?? []).map((p) => ({ id: p.id as string, nome: p.nome as string, codigo: p.codigo as string })),
      kits: porProcedimento,
      estoque: disponivel ? Object.fromEntries(disponivel.map((d) => [d.product_id, { ...d, disponivel: Number(d.disponivel) }])) : null,
    },
    { requestId },
  );
}
