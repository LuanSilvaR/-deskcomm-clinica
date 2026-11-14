/**
 * PUT /api/v1/clinic/atendimentos/:id/conduta — autosave da conduta (FORK
 * clinic, prontuário F4): o que foi decidido, protocolo e recomendações.
 * Versão velha → 409, nada sobrescrito.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const texto = z.string().max(5000).nullish();
const corpo = z
  .object({ descricao: texto, protocolo: texto, recomendacoes: texto, versao: z.number().int().min(0) })
  .strict();

const limpo = (v: string | null | undefined) => (v && v.trim() ? v : null);

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("atendimento.registrar", { requestId, resource: "clinic_condutas" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const d = lido.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_salvar_conduta", {
    p_org: org,
    p_atendimento: id,
    p_descricao: limpo(d.descricao),
    p_protocolo: limpo(d.protocolo),
    p_recomendacoes: limpo(d.recomendacoes),
    p_versao_esperada: d.versao,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; versao: number; criado: boolean };
  if (r.criado) {
    void audit({
      action: "clinic.registro_criado",
      actorUserId: authz.user.id,
      organizationId: org,
      resourceType: "clinic_conduta",
      resourceId: r.id,
      requestId,
      metadata: { secao: "conduta", atendimento_id: id },
    });
  }
  return ok({ id: r.id, versao: r.versao, salvo_em: new Date().toISOString() }, { requestId });
}
