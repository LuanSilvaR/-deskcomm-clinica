/**
 * GET /api/v1/clinic/proximos-livres?event_type_id=<uuid> — FORK clinic (E1.3).
 *
 * O primeiro horário livre de cada profissional que pode fazer o atendimento,
 * do mais cedo para o mais tarde. Só com as regras de profissionais ligadas
 * (`settings.clinic.profissionais`); desligadas, devolve `ligado: false` e a
 * tela não mostra nada. Leitura (viewer), pela sessão — a RLS de quem pede vale.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { candidatosDoTipo, proximosLivres } from "@/lib/clinic/agenda/proximos-livres";
import { clinicProfissionaisDaOrg } from "@/lib/clinic/flags";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const querySchema = z.object({ event_type_id: z.string().uuid() });

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const lido = querySchema.safeParse({ event_type_id: new URL(req.url).searchParams.get("event_type_id") ?? undefined });
  if (!lido.success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });

  const supabase = await createClient();
  const org = authz.org.orgId;
  if (!(await clinicProfissionaisDaOrg(supabase, org))) {
    return ok({ ligado: false, proximos: [], sem_horario: [] }, { requestId });
  }

  const candidatos = await candidatosDoTipo(supabase, org, lido.data.event_type_id);
  if (!candidatos.ok) return fail("internal_error", candidatos.erro, 500, { requestId });

  const resultado = await proximosLivres(supabase, org, {
    eventTypeId: lido.data.event_type_id,
    candidatos: candidatos.userIds,
    agora: new Date(),
  });
  return ok({ ligado: true, ...resultado }, { requestId });
}
