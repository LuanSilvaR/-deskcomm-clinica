/**
 * POST /api/v1/clinic/agendamentos/:id/chegada — "Paciente chegou".
 *
 * Registra a chegada do paciente de um agendamento (agent+, é a recepção). Com
 * `organizations.settings.clinic.ficha_obrigatoria` ligada, só registra se a
 * ficha cadastral estiver completa — senão 422 `ficha_incompleta` com a lista
 * do que falta, para a tela abrir a ficha ali mesmo.
 *
 * Idempotente: a segunda chegada do mesmo agendamento devolve a primeira.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { falhaDoBanco } from "@/lib/clinic/api";
import { fichaPermiteAtendimento } from "@/lib/clinic/pacientes/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** A chegada registrada deste agendamento, ou `null` (viewer: a tela só lê). */
export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "clinic_appointment_arrivals" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_appointment_arrivals")
    .select("id, arrived_at")
    .eq("organization_id", authz.org.orgId)
    .eq("appointment_id", id)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok(data ?? null, { requestId });
}

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "clinic_appointment_arrivals" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "id inválido", 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: agendamento, error: erroAg } = await supabase
    .from("calendar_appointments")
    .select("id, contact_id, status")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (erroAg) return fail("internal_error", erroAg.message, 500, { requestId });
  if (!agendamento) return fail("not_found", t("Agendamento não encontrado."), 404, { requestId });
  if (!agendamento.contact_id) {
    return fail("validation_failed", t("Este agendamento não tem paciente vinculado."), 422, { requestId });
  }
  if (agendamento.status === "cancelled") {
    return fail("validation_failed", t("Este agendamento foi cancelado."), 422, { requestId });
  }

  const { data: existente } = await supabase
    .from("clinic_appointment_arrivals")
    .select("id, arrived_at")
    .eq("organization_id", org)
    .eq("appointment_id", id)
    .maybeSingle();
  if (existente) return ok({ ...existente, ja_registrada: true }, { requestId });

  const permite = await fichaPermiteAtendimento(supabase, org, agendamento.contact_id as string);
  if (!permite.ok && "erro" in permite) return fail("internal_error", permite.erro, 500, { requestId });
  if (!permite.ok) {
    return fail("ficha_incompleta", t("Complete a ficha do paciente antes de registrar a chegada."), 422, {
      requestId,
      details: { faltando: permite.faltando },
    });
  }

  const { data, error } = await supabase
    .from("clinic_appointment_arrivals")
    .insert({ organization_id: org, appointment_id: id, contact_id: agendamento.contact_id, registered_by: authz.user.id })
    .select("id, arrived_at")
    .single();
  if (error) return falhaDoBanco(error, requestId, t);

  void audit({
    action: "clinic.chegada_registrada",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "calendar_appointment",
    resourceId: id,
    requestId,
    metadata: { contato: agendamento.contact_id },
  });
  return ok({ ...data, ja_registrada: false }, { requestId, status: 201 });
}
