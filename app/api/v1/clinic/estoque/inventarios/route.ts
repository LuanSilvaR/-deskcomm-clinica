/**
 * /api/v1/clinic/estoque/inventarios — FORK clinic (estoque E6).
 *
 * GET (`estoque.ver`): os inventários mais recentes. POST
 * (`estoque.inventariar`): abre um inventário no local — fotografa o saldo de
 * cada lote; um aberto por local.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { abrirInventarioSchema } from "@/lib/clinic/estoque/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.ver", { requestId, resource: "clinic_estoque_inventarios" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_estoque_inventarios")
    .select("id, local_id, status, motivo, created_at, fechado_em")
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return fail("internal_error", t("Não foi possível ler os inventários."), 500, { requestId });
  return ok({ inventarios: data ?? [], pode_inventariar: authz.permissoes.has("estoque.inventariar") }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.inventariar", { requestId, resource: "clinic_estoque_inventarios" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = abrirInventarioSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_inventario_abrir", {
    p_org: org,
    p_local: lido.data.local_id,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; itens: number };
  void audit({
    action: "clinic.estoque_inventario_aberto",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_inventario",
    resourceId: r.id,
    requestId,
    metadata: { numero: r.itens },
  });
  return ok(r, { requestId, status: 201 });
}
