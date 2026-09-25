/**
 * GET /api/v1/clinic/procedimentos/opcoes — o que a seção Procedimentos do
 * atendimento oferece para escolher (FORK clinic, prontuário F5): o catálogo de
 * procedimentos ativos (9015) e os produtos ativos. Sem dado de paciente.
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
  const [procs, produtos] = await Promise.all([
    supabase.from("clinic_procedures").select("id, name").eq("organization_id", org).eq("is_active", true).order("name"),
    supabase.from("catalog_products").select("id, nome, codigo").eq("organization_id", org).eq("ativo", true).order("nome").limit(500),
  ]);
  const erro = procs.error ?? produtos.error;
  if (erro) return fail("internal_error", erro.message, 500, { requestId });
  return ok(
    {
      procedimentos: (procs.data ?? []).map((p) => ({ id: p.id as string, nome: p.name as string })),
      produtos: (produtos.data ?? []).map((p) => ({ id: p.id as string, nome: p.nome as string, codigo: p.codigo as string })),
    },
    { requestId },
  );
}
