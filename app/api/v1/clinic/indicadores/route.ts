/**
 * GET /api/v1/clinic/indicadores?dias=7|30|90 — FORK clinic (E6).
 *
 * Os indicadores da agenda nos últimos N dias até agora (ver
 * lib/clinic/agenda/indicadores.ts). A partir de gerente, pela sessão.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { diaLocalISO } from "@/lib/agenda/fuso";
import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { calcularIndicadores, diasDoPeriodo, type JornadaSemanal } from "@/lib/clinic/agenda/indicadores";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const querySchema = z.object({ dias: z.enum(["7", "30", "90"]).default("30") });

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("relatorios.gerencial", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const lido = querySchema.safeParse({ dias: new URL(req.url).searchParams.get("dias") ?? undefined });
  if (!lido.success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });

  const org = authz.org.orgId;
  const dias = Number(lido.data.dias);
  const ate = new Date();
  const de = new Date(ate.getTime() - dias * 86_400_000);

  const supabase = await createClient();
  const { data: organizacao } = await supabase.from("organizations").select("timezone").eq("id", org).maybeSingle();
  const fuso = (organizacao as { timezone?: string | null } | null)?.timezone || "America/Sao_Paulo";

  const [ags, visitas, confirmacoes, jornadas] = await Promise.all([
    supabase
      .from("calendar_appointments")
      .select("id, owner_user_id, status, starts_at, ends_at")
      .eq("organization_id", org)
      .neq("source", "google_sync")
      .gte("starts_at", de.toISOString())
      .lt("starts_at", ate.toISOString())
      .limit(10000),
    supabase
      .from("clinic_appointment_visits")
      .select("arrived_at, started_at, finished_at")
      .eq("organization_id", org)
      .gte("arrived_at", de.toISOString())
      .limit(10000),
    supabase
      .from("clinic_confirmation_requests")
      .select("status")
      .eq("organization_id", org)
      .gte("requested_at", de.toISOString())
      .limit(10000),
    supabase.from("attendant_availability").select("user_id, schedule").eq("organization_id", org),
  ]);
  const erro = ags.error ?? visitas.error ?? confirmacoes.error ?? jornadas.error;
  if (erro) return fail("internal_error", erro.message, 500, { requestId });

  const indicadores = calcularIndicadores({
    compromissos: (ags.data ?? []) as { owner_user_id: string | null; status: string; starts_at: string; ends_at: string }[],
    visitas: (visitas.data ?? []) as { arrived_at: string | null; started_at: string | null; finished_at: string | null }[],
    confirmacoes: (confirmacoes.data ?? []) as { status: string }[],
    jornadas: (jornadas.data ?? []) as unknown as JornadaSemanal[],
    dias: diasDoPeriodo(diaLocalISO(de, fuso), diaLocalISO(new Date(ate.getTime() - 1), fuso)),
  });
  return ok({ dias, de: de.toISOString(), ate: ate.toISOString(), ...indicadores }, { requestId });
}
