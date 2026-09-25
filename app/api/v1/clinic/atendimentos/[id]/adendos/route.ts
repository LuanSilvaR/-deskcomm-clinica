/**
 * POST /api/v1/clinic/atendimentos/:id/adendos — correção de registro finalizado.
 *
 * O registro original nunca muda: o adendo fica ao lado dele, com texto, motivo,
 * autor e data. Só em atendimento finalizado e com `prontuario.adendo`
 * (`fn_clinic_adicionar_adendo`, migration 9019).
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

const corpo = z
  .object({
    alvo_tipo: z.enum(["formulario", "evolucao", "conduta", "procedimento"]),
    alvo_id: z.string().uuid(),
    texto: z.string().trim().min(1).max(5000),
    motivo: z.string().trim().min(3).max(300),
  })
  .strict();

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("prontuario.adendo", { requestId, resource: "clinic_adendos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Escreva o adendo e o motivo (mínimo de 3 letras)."), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_clinic_adicionar_adendo", {
    p_org: org,
    p_atendimento: id,
    p_alvo_tipo: lido.data.alvo_tipo,
    p_alvo_id: lido.data.alvo_id,
    p_texto: lido.data.texto,
    p_motivo: lido.data.motivo,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string };
  void audit({
    action: "clinic.adendo_criado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_adendo",
    resourceId: r.id,
    requestId,
    metadata: { alvo_tipo: lido.data.alvo_tipo, atendimento_id: id },
  });
  return ok(r, { requestId, status: 201 });
}
