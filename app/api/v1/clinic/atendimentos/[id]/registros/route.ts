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
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: at, error } = await supabase
    .from("clinic_atendimentos")
    .select("id, status, specialty_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!at) return fail("not_found", t("Atendimento não encontrado."), 404, { requestId });

  try {
    const registros = (await registrosDosAtendimentos(supabase, org, [id])).get(id)!;
    return ok(
      {
        status: at.status as string,
        especialidade_id: (at.specialty_id as string | null) ?? null,
        pode_registrar: at.status === "em_andamento" && authz.permissoes.has("atendimento.registrar"),
        pode_adendo: at.status === "finalizado" && authz.permissoes.has("prontuario.adendo"),
        ...registros,
      },
      { requestId },
    );
  } catch (e) {
    return fail("internal_error", (e as Error).message, 500, { requestId });
  }
}
