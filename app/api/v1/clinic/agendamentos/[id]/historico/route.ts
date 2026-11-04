/**
 * GET /api/v1/clinic/agendamentos/[id]/historico — FORK clinic (agenda S4).
 *
 * A linha do tempo COMPLETA do agendamento, para o detalhe: o que aconteceu
 * com o compromisso (`clinic_agenda_historico`, migration 9043: criado,
 * confirmado, remarcado, cancelado com motivo, faltou, realizado, profissional
 * trocado) e com a visita do paciente (`clinic_appointment_visit_events`:
 * chegada, pronto, atendimento, correções com motivo), em ordem. Na agenda
 * aparece só o último status; aqui fica tudo.
 *
 * `agenda.ver`; o agendamento de um colega exige `agenda.ver_outros`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { escopoDaLeitura } from "@/lib/clinic/agenda/escopo-da-agenda";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export interface MarcoDoHistorico {
  origem: "agendamento" | "visita";
  tipo: string;
  quando: string;
  por: string | null;
  motivo: string | null;
  inicio_antes?: string | null;
  inicio_depois?: string | null;
  correcao?: boolean;
}

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("agenda.ver", { requestId, resource: "calendar_appointments" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data: ag } = await supabase
    .from("calendar_appointments")
    .select("owner_user_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!ag) return fail("not_found", t("Agendamento não encontrado."), 404, { requestId });
  const escopo = escopoDaLeitura({
    permissoes: authz.permissoes,
    usuarioId: authz.user.id,
    pedido: (ag as { owner_user_id: string | null }).owner_user_id,
  });
  if (!escopo.ok) {
    return fail("forbidden_permission", t("Você só pode ver a sua própria agenda."), 403, {
      requestId,
      details: { permissao: "agenda.ver_outros" },
    });
  }

  const [hist, eventos] = await Promise.all([
    supabase
      .from("clinic_agenda_historico")
      .select("tipo, motivo, ator, inicio_antes, inicio_depois, created_at")
      .eq("organization_id", org)
      .eq("appointment_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("clinic_appointment_visit_events")
      .select("to_status, is_correction, reason, changed_by, created_at")
      .eq("organization_id", org)
      .eq("appointment_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  const erro = hist.error ?? eventos.error;
  if (erro) return fail("internal_error", erro.message, 500, { requestId });

  const marcos: MarcoDoHistorico[] = [
    ...((hist.data ?? []) as Array<{ tipo: string; motivo: string | null; ator: string | null; inicio_antes: string | null; inicio_depois: string | null; created_at: string }>).map(
      (h) => ({
        origem: "agendamento" as const,
        tipo: h.tipo,
        quando: h.created_at,
        por: h.ator,
        motivo: h.motivo,
        inicio_antes: h.inicio_antes,
        inicio_depois: h.inicio_depois,
      }),
    ),
    ...((eventos.data ?? []) as Array<{ to_status: string; is_correction: boolean; reason: string | null; changed_by: string | null; created_at: string }>).map(
      (e) => ({
        origem: "visita" as const,
        tipo: e.to_status,
        quando: e.created_at,
        por: e.changed_by,
        motivo: e.reason,
        correcao: e.is_correction,
      }),
    ),
  ].sort((a, b) => a.quando.localeCompare(b.quando));

  return ok({ marcos }, { requestId });
}
