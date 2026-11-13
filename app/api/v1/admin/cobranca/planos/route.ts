/**
 * /api/v1/admin/cobranca/planos — FORK (card #159; origem upstream, spec da
 * cobrança §2.2): os planos de cobrança da plataforma.
 *
 * GET lista (arquivados por último); POST cria. Plano é da INSTALAÇÃO (sem
 * `organization_id`). Escrita de admin de plataforma com escopo `full` e MFA;
 * 404 com o módulo `cobranca` desligado. Dois planos do cadastro ao mesmo
 * tempo → 409 `state_conflict` (índice `cobranca_planos_um_padrao`). Toda
 * criação é auditada (`cobranca.plano_salvo`).
 */
import { type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { guardaDaCobranca } from "@/lib/cobranca/guarda";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { COLUNAS_DO_PLANO, novoPlanoSchema } from "@/lib/schemas/cobranca-plano";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  const g = await guardaDaCobranca(requestId, false);
  if (!g.ok) return g.resposta;
  const { data, error } = await g.admin
    .from("cobranca_planos")
    .select(COLUNAS_DO_PLANO)
    .order("arquivado_em", { ascending: true, nullsFirst: true })
    .order("preco_cents", { ascending: true });
  if (error) return fail("internal_error", "Não foi possível carregar os planos", 500, { requestId });
  return ok(data ?? [], { requestId });
}

export async function POST(req: NextRequest) {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const g = await guardaDaCobranca(requestId, true);
  if (!g.ok) return g.resposta;

  const corpo = novoPlanoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", "Plano inválido", 400, { requestId, details: corpo.error.flatten() });
  }

  const { data: plano, error } = await g.admin
    .from("cobranca_planos")
    .insert({ ...corpo.data, updated_by: g.ctx.user.id })
    .select(COLUNAS_DO_PLANO)
    .single();
  if (error?.code === "23505") {
    return fail("state_conflict", "Já existe um plano do cadastro. Desmarque o outro antes.", 409, { requestId });
  }
  if (error || !plano) return fail("internal_error", "Não foi possível salvar o plano", 500, { requestId });

  await audit({
    action: "cobranca.plano_salvo",
    actorUserId: g.ctx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    resourceType: "cobranca_plano",
    resourceId: plano.id,
    requestId,
    metadata: { criado: true, ...corpo.data },
  });
  return ok(plano, { status: 201, requestId });
}
