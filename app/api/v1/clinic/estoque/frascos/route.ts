/**
 * POST /api/v1/clinic/estoque/frascos — FORK clinic (estoque E4).
 *
 * Abre um frasco de produto fracionável: o conteúdo de 1 unidade de estoque
 * passa do lacrado para o frasco (o saldo não muda) e o frasco ganha prazo
 * (horas após aberto, limitado à validade do lote). `estoque.movimentar`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { abrirFrascoSchema } from "@/lib/clinic/estoque/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.movimentar", {
    requestId,
    resource: "clinic_estoque_frascos",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = abrirFrascoSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_frasco_abrir", {
    p_org: org,
    p_dados: lido.data,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { frasco_id: string };
  void audit({
    action: "clinic.estoque_movimentado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_frasco",
    resourceId: r.frasco_id,
    requestId,
    metadata: { tipo: "abertura_frasco" },
  });
  return ok(r, { requestId, status: 201 });
}
