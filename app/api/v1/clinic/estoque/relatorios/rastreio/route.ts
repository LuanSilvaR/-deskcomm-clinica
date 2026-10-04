/**
 * GET /api/v1/clinic/estoque/relatorios/rastreio?lote= — FORK clinic (estoque E8).
 *
 * RECALL: quais pacientes receberam um lote, quando e com qual profissional.
 * É dado de saúde: chave clínica `estoque.rastreio_lote` (administrador e
 * suporte não recebem por padrão), limite de leituras por pessoa e auditoria
 * da leitura (só ids e contagem — nunca o nome do paciente no log).
 *
 * Estoque E10 (9038): `?tipo=` diz por que se consulta (categoria, não texto
 * livre) e a função do banco grava a auditoria e conta o limite na MESMA
 * transação — a leitura não existe sem o registro.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoEstoque } from "@/lib/clinic/estoque/erros";
import { TIPOS_DE_CONSULTA_DO_RASTREIO } from "@/lib/clinic/estoque/schemas";
import { leituraClinicaPermitida } from "@/lib/clinic/prontuario/limite";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("estoque.rastreio_lote", { requestId, resource: "clinic_estoque_lotes" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const loteId = req.nextUrl.searchParams.get("lote");
  if (!loteId || !z.string().uuid().safeParse(loteId).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const tipo = z.enum(TIPOS_DE_CONSULTA_DO_RASTREIO).safeParse(req.nextUrl.searchParams.get("tipo"));
  if (!tipo.success) return fail("validation_failed", t("Escolha o motivo da consulta."), 422, { requestId });
  if (!(await leituraClinicaPermitida(authz.user.id, "estoque-rastreio"))) {
    return fail("rate_limited", t("Muitas leituras seguidas. Aguarde alguns minutos."), 429, { requestId });
  }
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_estoque_rel_rastreio_lote", {
    p_org: org,
    p_lote: loteId,
    p_tipo: tipo.data,
  });
  if (error) {
    const e = erroDoEstoque(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  return ok(data as { lote: Record<string, unknown>; pacientes: unknown[] }, { requestId });
}
