/**
 * PUT /api/v1/clinic/atendimentos/:id/formularios/:tipo — autosave da anamnese
 * ou da avaliação.
 *
 * Corpo: `{ modelo_versao_id, respostas, versao }`. `versao` é a que a tela tem
 * (0 = ainda não existe); se outra aba gravou antes, o banco responde conflito
 * e nada é sobrescrito (409). As respostas são validadas contra os campos da
 * versão do modelo — chave que não existe no modelo é recusada.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { validarRespostas } from "@/lib/clinic/formularios/campos";
import { lerCampos } from "@/lib/clinic/prontuario/leitura";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; tipo: string }> };

const corpo = z
  .object({
    modelo_versao_id: z.string().uuid(),
    respostas: z.record(z.string(), z.unknown()),
    versao: z.number().int().min(0),
  })
  .strict();

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("atendimento.registrar", { requestId, resource: "clinic_formularios_preenchidos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);

  const { id, tipo } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  if (tipo !== "anamnese" && tipo !== "avaliacao") return fail("not_found", t("Seção inválida."), 404, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: versao, error: e1 } = await supabase
    .from("clinic_modelos_formulario_versoes")
    .select("campos")
    .eq("organization_id", org)
    .eq("id", lido.data.modelo_versao_id)
    .maybeSingle();
  if (e1) return fail("internal_error", e1.message, 500, { requestId });
  if (!versao) return fail("validation_failed", t("Modelo de formulário inválido para esta seção."), 422, { requestId });

  const validado = validarRespostas(lerCampos(versao.campos), lido.data.respostas);
  if (!validado.ok) {
    return fail("validation_failed", t("Respostas inválidas."), 422, { requestId, details: { erros: validado.erros } });
  }

  const { data, error } = await supabase.rpc("fn_clinic_salvar_formulario", {
    p_org: org,
    p_atendimento: id,
    p_tipo: tipo,
    p_modelo_versao: lido.data.modelo_versao_id,
    p_respostas: validado.respostas,
    p_versao_esperada: lido.data.versao,
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
      resourceType: "clinic_formulario",
      resourceId: r.id,
      requestId,
      metadata: { secao: tipo, atendimento_id: id },
    });
  }
  return ok({ id: r.id, versao: r.versao, salvo_em: new Date().toISOString() }, { requestId });
}
