/**
 * PUT /api/v1/clinic/atendimentos/:id/procedimentos — cria (sem `id`) ou
 * atualiza (com `id` e `versao`) um procedimento realizado e troca a lista de
 * insumos (FORK clinic, prontuário F5). Só com o atendimento em andamento.
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

const insumo = z
  .object({
    descricao: z.string().trim().min(1).max(200),
    quantidade: z.number().positive().max(1_000_000),
    unidade: z.string().trim().min(1).max(20).default("un"),
    product_id: z.string().uuid().nullish(),
    lote: z.string().trim().max(60).nullish(),
    registro_anvisa: z.string().trim().max(40).nullish(),
    validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  })
  .strict();
const corpo = z
  .object({
    id: z.string().uuid().nullish(),
    versao: z.number().int().min(0),
    procedimento: z
      .object({
        descricao: z.string().trim().min(1).max(200),
        procedure_id: z.string().uuid().nullish(),
        event_type_id: z.string().uuid().nullish(),
        plano_sessao_id: z.string().uuid().nullish(),
        regiao: z.string().max(200).nullish(),
        parametros: z.record(z.string().trim().min(1).max(60), z.string().max(500)).default({}),
        intercorrencias: z.string().max(2000).nullish(),
        observacoes: z.string().max(2000).nullish(),
      })
      .strict(),
    insumos: z.array(insumo).max(50),
  })
  .strict();

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("atendimento.registrar", { requestId, resource: "clinic_procedimentos_realizados" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const d = lido.data;
  if (Object.keys(d.procedimento.parametros).length > 30) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_procedimento_salvar", {
    p_org: org,
    p_atendimento: id,
    p_procedimento: d.id ?? null,
    p_dados: d.procedimento,
    p_insumos: d.insumos,
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
      resourceType: "clinic_procedimento_realizado",
      resourceId: r.id,
      requestId,
      metadata: { secao: "procedimento", atendimento_id: id, insumos: d.insumos.length },
    });
  }
  return ok({ id: r.id, versao: r.versao }, { requestId });
}
