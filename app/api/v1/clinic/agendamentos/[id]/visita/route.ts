/**
 * /api/v1/clinic/agendamentos/:id/visita — o status da visita do paciente agendado.
 *
 * GET (viewer): o estado atual e o histórico (de → para, quem, quando, correção).
 * POST (agent+): muda o estado — `{ status, motivo? }`. Voltar um passo é
 * correção e exige motivo. Regras em `lib/clinic/visitas/mudar-status.ts`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { ApiError } from "@/lib/api/types";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { mudarStatusDaVisita } from "@/lib/clinic/visitas/mudar-status";
import { STATUS_DA_VISITA } from "@/lib/clinic/visitas/status";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { contarFaltas } from "@/lib/clinic/agenda/faltas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "clinic_appointment_visits" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const [{ data: visita, error: e1 }, { data: eventos, error: e2 }, { data: confirmacao }, { data: alocados }] = await Promise.all([
    supabase
      .from("clinic_appointment_visits")
      .select("status, changed_at, changed_by, arrived_at, ready_at, started_at, finished_at")
      .eq("organization_id", org)
      .eq("appointment_id", id)
      .maybeSingle(),
    supabase
      .from("clinic_appointment_visit_events")
      .select("id, from_status, to_status, is_correction, reason, changed_by, created_at")
      .eq("organization_id", org)
      .eq("appointment_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
    // FORK clinic (9004): a resposta do paciente ao pedido de confirmação.
    supabase
      .from("clinic_confirmation_requests")
      .select("status, falha, requested_at, answered_at")
      .eq("organization_id", org)
      .eq("appointment_id", id)
      .maybeSingle(),
    // FORK clinic (9007): a sala e o equipamento que o compromisso ocupa.
    supabase
      .from("clinic_appointment_resources")
      .select("clinic_resources(name, category)")
      .eq("organization_id", org)
      .eq("appointment_id", id),
  ]);
  if (e1 || e2) return fail("internal_error", (e1 ?? e2)!.message, 500, { requestId });
  // FORK clinic (E5.1): as faltas do paciente nos últimos 12 meses.
  const { data: ag } = await supabase.from("calendar_appointments").select("contact_id").eq("organization_id", org).eq("id", id).maybeSingle();
  const contatoId = (ag as { contact_id?: string | null } | null)?.contact_id ?? null;
  const faltas = contatoId ? ((await contarFaltas(supabase, org, [contatoId])).get(contatoId) ?? 0) : 0;
  return ok(
    {
      visita: visita ?? { status: "agendado" },
      eventos: eventos ?? [],
      confirmacao: confirmacao ?? null,
      faltas,
      recursos: (alocados ?? []).flatMap((a) => {
        const r = (a as { clinic_resources: { name: string } | { name: string }[] | null }).clinic_resources;
        return (Array.isArray(r) ? r : r ? [r] : []).map((x) => x.name);
      }),
    },
    { requestId },
  );
}

const postSchema = z.object({
  status: z.enum(STATUS_DA_VISITA),
  motivo: z.string().trim().max(300).nullish(),
});

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "clinic_appointment_visits" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });

  const lido = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Status inválido."), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: agendamento, error: erroAg } = await supabase
    .from("calendar_appointments")
    .select("id, contact_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (erroAg) return fail("internal_error", erroAg.message, 500, { requestId });
  if (!agendamento) return fail("not_found", t("Agendamento não encontrado."), 404, { requestId });

  try {
    const r = await mudarStatusDaVisita(
      supabase,
      { organization_id: org, actor: { type: "user", id: authz.user.id }, requestId },
      {
        appointmentId: id,
        contactId: (agendamento.contact_id as string | null) ?? null,
        para: lido.data.status,
        motivo: lido.data.motivo ?? null,
      },
    );
    if (r.mudou) {
      void audit({
        action: "clinic.visita_status_alterado",
        actorUserId: authz.user.id,
        organizationId: org,
        resourceType: "calendar_appointment",
        resourceId: id,
        requestId,
        metadata: { de: r.de, para: r.status, correcao: r.correcao },
      });
    }
    return ok(r, { requestId });
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, t(err.message), err.status, {
        details: err.details as Record<string, unknown> | undefined,
        requestId,
      });
    }
    throw err;
  }
}
