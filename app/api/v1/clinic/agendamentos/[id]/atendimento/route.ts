/**
 * POST /api/v1/clinic/agendamentos/:id/atendimento — "Iniciar atendimento".
 *
 * Cria (ou devolve, se já aberto) o atendimento clínico do agendamento e leva a
 * visita para `em_atendimento`. Corpo opcional: `{ especialidade_id }` quando o
 * profissional atende mais de uma especialidade exigida pelo tipo. Regras no
 * banco (`fn_clinic_iniciar_atendimento`, migration 9017).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { ApiError } from "@/lib/api/types";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { iniciarAtendimento } from "@/lib/clinic/atendimento/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const corpo = z.object({ especialidade_id: z.string().uuid().nullish() }).strict();

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requirePermission("atendimento.iniciar", { requestId, resource: "clinic_atendimentos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const supabase = await createClient();

  // FORK clinic (agenda S4): o atendimento começa quando a recepção libera o
  // paciente ("Pronto para atendimento"); "em atendimento" é retomar o aberto.
  // Quem pode iniciar (só o profissional do agendamento) o banco decide (9043).
  const { data: visita } = await supabase
    .from("clinic_appointment_visits")
    .select("status")
    .eq("organization_id", org)
    .eq("appointment_id", id)
    .maybeSingle();
  const statusDaVisita = (visita as { status?: string } | null)?.status ?? "agendado";
  if (statusDaVisita !== "pronto" && statusDaVisita !== "em_atendimento") {
    return fail(
      "atendimento_paciente_nao_pronto",
      t("O paciente ainda não está pronto para atendimento: a recepção libera em \"Pronto para atendimento\"."),
      409,
      { requestId },
    );
  }

  try {
    const r = await iniciarAtendimento(
      supabase,
      { organization_id: org, actor: { type: "user", id: authz.user.id }, requestId },
      { appointmentId: id, especialidadeId: lido.data.especialidade_id ?? null },
    );
    if (r.criado) {
      void audit({
        action: "clinic.atendimento_iniciado",
        actorUserId: authz.user.id,
        organizationId: org,
        resourceType: "clinic_atendimento",
        resourceId: r.id,
        requestId,
        metadata: { appointment_id: id },
      });
    }
    return ok(r, { requestId, status: r.criado ? 201 : 200 });
  } catch (err) {
    if (err instanceof ApiError) return fail(err.code, t(err.message), err.status, { requestId });
    throw err;
  }
}
