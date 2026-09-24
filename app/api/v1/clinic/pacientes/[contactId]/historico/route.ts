/**
 * GET /api/v1/clinic/pacientes/:contactId/historico?antes=<ISO> — o histórico
 * de agendamentos e atendimentos do paciente (fork clinic, migration 9003).
 *
 * Do mais recente ao mais antigo, 20 por página (`antes` = `inicio` do último
 * item recebido). Cada agendamento traz tipo, profissional, estado do núcleo,
 * status da visita e os marcos (quem mudou, quando, correções). Cancelados e
 * faltas aparecem: são história do paciente.
 *
 * Existe à parte da timeline do núcleo (`/api/v1/contacts/:id/timeline`), que
 * lê `crm_lead_activities` — depende de lead e não conhece a visita.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { ehStatusDaVisita } from "@/lib/clinic/visitas/status";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contactId: string }> };
const POR_PAGINA = 20;

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("pacientes.ver", { requestId, resource: "calendar_appointments" });
  if (!authz.ok) return authz.response;
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) return fail("validation_failed", "id inválido", 422, { requestId });
  const antes = new URL(req.url).searchParams.get("antes");
  if (antes !== null && !z.string().datetime({ offset: true }).safeParse(antes).success) {
    return fail("validation_failed", "cursor inválido", 422, { requestId });
  }
  const org = authz.org.orgId;

  const supabase = await createClient();
  let q = supabase
    .from("calendar_appointments")
    .select("id, title, starts_at, ends_at, status, owner_user_id, cancellation_reason, calendar_event_types(name)")
    .eq("organization_id", org)
    .eq("contact_id", contactId)
    .order("starts_at", { ascending: false })
    .limit(POR_PAGINA + 1);
  if (antes) q = q.lt("starts_at", antes);
  const { data: agendamentos, error } = await q;
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const pagina = (agendamentos ?? []).slice(0, POR_PAGINA);
  const temMais = (agendamentos ?? []).length > POR_PAGINA;
  const ids = pagina.map((a) => a.id as string);

  const [{ data: visitas, error: e1 }, { data: eventos, error: e2 }] = ids.length
    ? await Promise.all([
        supabase.from("clinic_appointment_visits").select("appointment_id, status").eq("organization_id", org).in("appointment_id", ids),
        supabase
          .from("clinic_appointment_visit_events")
          .select("appointment_id, from_status, to_status, is_correction, reason, changed_by, created_at")
          .eq("organization_id", org)
          .in("appointment_id", ids)
          .order("created_at", { ascending: true }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (e1 || e2) return fail("internal_error", (e1 ?? e2)!.message, 500, { requestId });

  const statusPorAg = new Map((visitas ?? []).map((v) => [v.appointment_id as string, v.status]));
  const eventosPorAg = new Map<string, unknown[]>();
  for (const e of eventos ?? []) {
    const k = e.appointment_id as string;
    const { appointment_id: _ignora, ...resto } = e;
    void _ignora;
    eventosPorAg.set(k, [...(eventosPorAg.get(k) ?? []), resto]);
  }

  const itens = pagina.map((a) => {
    const s = statusPorAg.get(a.id as string);
    const tipo = a.calendar_event_types as { name?: string } | { name?: string }[] | null;
    return {
      appointment_id: a.id,
      titulo: a.title,
      tipo: (Array.isArray(tipo) ? tipo[0]?.name : tipo?.name) ?? null,
      inicio: a.starts_at,
      fim: a.ends_at,
      status_do_agendamento: a.status,
      motivo_do_cancelamento: a.cancellation_reason,
      profissional_id: a.owner_user_id,
      status_da_visita: ehStatusDaVisita(s) ? s : "agendado",
      marcos: eventosPorAg.get(a.id as string) ?? [],
    };
  });

  return ok({ itens }, { requestId, meta: { has_more: temMais, cursor: temMais ? (pagina.at(-1)?.starts_at as string) : null } });
}
