/**
 * PATCH /api/v1/clinic/documentos/modelos/:id — nome, ativo, texto e opções
 * (FORK clinic, prontuário F6). Mudar texto ou opções publica versão NOVA; quem
 * já aceitou continua ligado à versão que aceitou.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { opcoesDoTermoSchema } from "@/lib/clinic/documentos/tipos";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const corpo = z
  .object({
    nome: z.string().trim().min(1).max(120),
    conteudo: z.string().min(1).max(50_000),
    opcoes: opcoesDoTermoSchema,
    ativo: z.boolean(),
    versao_atual: z.number().int().min(1),
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("modelos_clinicos.gerenciar", { requestId, resource: "clinic_modelos_documento" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const d = lido.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_documento_modelo_salvar", {
    p_org: org,
    p_modelo: id,
    p_tipo: null,
    p_nome: d.nome,
    p_conteudo: d.conteudo,
    p_opcoes: d.opcoes,
    p_ativo: d.ativo,
    p_versao_esperada: d.versao_atual,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; versao_id: string; numero: number };
  void audit({
    action: "clinic.documento_modelo_salvo",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_modelo_documento",
    resourceId: id,
    requestId,
    metadata: { numero: r.numero, ativo: d.ativo },
  });
  return ok(r, { requestId });
}
