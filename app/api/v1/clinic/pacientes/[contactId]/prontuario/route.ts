/**
 * GET /api/v1/clinic/pacientes/:contactId/prontuario?antes=<ISO>&limite=20
 *
 * A linha do tempo clínica do paciente: atendimentos do mais novo para o mais
 * antigo, cada um com anamnese, avaliação, evolução e adendos. Paginada por
 * cursor (`antes` = início do último atendimento recebido), nunca o histórico
 * inteiro de uma vez. Exige `prontuario.ver`; toda leitura é auditada (só
 * metadados).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { leituraClinicaPermitida } from "@/lib/clinic/prontuario/limite";
import { lerLinhaDoTempo } from "@/lib/clinic/prontuario/linha-do-tempo";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contactId: string }> };

const query = z
  .object({
    antes: z.string().datetime({ offset: true }).optional(),
    limite: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("prontuario.ver", { requestId, resource: "clinic_atendimentos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);

  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!lido.success) return fail("validation_failed", t("Parâmetros inválidos."), 422, { requestId });
  if (!(await leituraClinicaPermitida(authz.user.id, "prontuario"))) {
    return fail("rate_limited", t("Muitas leituras seguidas. Aguarde alguns minutos."), 429, { requestId });
  }
  const org = authz.org.orgId;

  const supabase = await createClient();
  const linha = await lerLinhaDoTempo(supabase, org, contactId, { antes: lido.data.antes, limite: lido.data.limite ?? 20 }).catch(
    () => null,
  );
  if (!linha) return fail("internal_error", t("Não foi possível ler o prontuário."), 500, { requestId });

  void audit({
    action: "clinic.prontuario_visto",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "contact",
    resourceId: contactId,
    requestId,
    metadata: { atendimentos: linha.atendimentos.length, pagina: lido.data.antes ? "seguinte" : "primeira" },
  });
  return ok(linha, { requestId });
}
