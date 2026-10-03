/**
 * POST /api/v1/clinic/estoque/locais — FORK clinic (estoque E0): cria um local
 * de estoque (central, sala, carrinho, farmácia). `estoque.configurar`.
 * A lista vem junto da posição (GET /estoque/posicao).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { localSchema } from "@/lib/clinic/estoque/schemas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.configurar", {
    requestId,
    resource: "clinic_estoque_locais",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const lido = localSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_local_salvar", {
    p_org: org,
    p_local: null,
    p_dados: lido.data,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(
      e.code,
      t(
        e.status === 409 && e.code === "conflict" ? "Já existe um local com esse nome." : e.message,
      ),
      e.status,
      {
        requestId,
      },
    );
  }
  const r = data as { id: string };
  void audit({
    action: "clinic.estoque_local_salvo",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_estoque_local",
    resourceId: r.id,
    requestId,
    metadata: { tipo: lido.data.tipo },
  });
  return ok(r, { requestId });
}
