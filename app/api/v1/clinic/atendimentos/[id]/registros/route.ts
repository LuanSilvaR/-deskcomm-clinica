/**
 * GET /api/v1/clinic/atendimentos/:id/registros — anamnese, avaliação, evolução
 * e adendos do atendimento, com os campos da versão de modelo usada em cada
 * formulário. Exige `prontuario.ver`; a RLS confere de novo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { registrosDosAtendimentos } from "@/lib/clinic/prontuario/leitura";
import { leituraClinicaPermitida } from "@/lib/clinic/prontuario/limite";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("prontuario.ver", { requestId, resource: "clinic_atendimentos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  if (!(await leituraClinicaPermitida(authz.user.id, "registros"))) {
    return fail("rate_limited", t("Muitas leituras seguidas. Aguarde alguns minutos."), 429, { requestId });
  }
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: at, error } = await supabase
    .from("clinic_atendimentos")
    .select("id, status, specialty_id, event_type_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!at) return fail("not_found", t("Atendimento não encontrado."), 404, { requestId });

  try {
    const registros = (await registrosDosAtendimentos(supabase, org, [id])).get(id)!;
    // FORK clinic (F4): o que a clínica exige para ESTE atendimento (9020), para
    // a tela avisar antes de o profissional tentar finalizar.
    const { data: regras } = await supabase
      .from("clinic_requisitos_finalizacao")
      .select("secao, event_type_id, specialty_id")
      .eq("organization_id", org);
    const exigidas = [
      ...new Set(
        (regras ?? [])
          .filter(
            (r) =>
              (!r.event_type_id || r.event_type_id === at.event_type_id) && (!r.specialty_id || r.specialty_id === at.specialty_id),
          )
          .map((r) => r.secao as string),
      ),
    ];
    return ok(
      {
        status: at.status as string,
        especialidade_id: (at.specialty_id as string | null) ?? null,
        pode_registrar: at.status === "em_andamento" && authz.permissoes.has("atendimento.registrar"),
        pode_adendo: at.status === "finalizado" && authz.permissoes.has("prontuario.adendo"),
        exigidas,
        ...registros,
      },
      { requestId },
    );
  } catch (e) {
    return fail("internal_error", (e as Error).message, 500, { requestId });
  }
}
