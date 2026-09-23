/**
 * Mudar o status da visita — a regra num lugar só (rota e, no futuro, a IA).
 *
 *   → na_recepcao (vindo de agendado): exige a ficha completa se a organização
 *     ligou `clinic.ficha_obrigatoria` (a mesma regra da 9002).
 *   → finalizado: grava `completed` ("Compareceu") no núcleo ANTES, pelo mesmo
 *     handler da agenda — que também cobra a ficha e recusa horário futuro.
 *   finalizado → outro (correção): devolve o núcleo a `confirmed`.
 *
 * O banco (`fn_clinic_mudar_status_visita`, security invoker) valida o resto:
 * paciente vinculado, agendamento não cancelado, motivo na correção, e grava
 * estado + evento de uma vez.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { alterarAgendamentoHandler } from "@/app/api/v1/agenda/agendamentos/_handler";
import type { HandlerCtx } from "@/lib/api/handlers/types";
import { ApiError } from "@/lib/api/types";
import { fichaPermiteAtendimento } from "@/lib/clinic/pacientes/servidor";

import { ehStatusDaVisita, type StatusDaVisita } from "./status";

const ERROS_DO_BANCO: Record<string, { status: number; code: string; mensagem: string }> = {
  visita_status_invalido: { status: 422, code: "validation_failed", mensagem: "Status inválido." },
  visita_agendamento_nao_encontrado: { status: 404, code: "not_found", mensagem: "Agendamento não encontrado." },
  visita_sem_paciente: { status: 422, code: "validation_failed", mensagem: "Este agendamento não tem paciente vinculado." },
  visita_agendamento_cancelado: { status: 422, code: "validation_failed", mensagem: "Este agendamento foi cancelado." },
  visita_correcao_sem_motivo: {
    status: 422,
    code: "validation_failed",
    mensagem: "Para voltar um passo, informe o motivo da correção.",
  },
};

export async function statusAtualDaVisita(
  supabase: SupabaseClient,
  organizationId: string,
  appointmentId: string,
): Promise<StatusDaVisita> {
  const { data } = await supabase
    .from("clinic_appointment_visits")
    .select("status")
    .eq("organization_id", organizationId)
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  const s = (data as { status?: unknown } | null)?.status;
  return ehStatusDaVisita(s) ? s : "agendado";
}

export async function mudarStatusDaVisita(
  supabase: SupabaseClient,
  ctx: HandlerCtx,
  args: { appointmentId: string; contactId: string | null; para: StatusDaVisita; motivo?: string | null },
): Promise<{ status: StatusDaVisita; de: StatusDaVisita; mudou: boolean; correcao: boolean }> {
  const de = await statusAtualDaVisita(supabase, ctx.organization_id, args.appointmentId);

  if (args.para === "na_recepcao" && de === "agendado") {
    const permite = await fichaPermiteAtendimento(supabase, ctx.organization_id, args.contactId);
    if (!permite.ok && "erro" in permite) throw new ApiError(500, "internal_error", undefined, ctx.requestId, permite.erro);
    if (!permite.ok) {
      throw new ApiError(
        422,
        "ficha_incompleta",
        { faltando: permite.faltando },
        ctx.requestId,
        "Complete a ficha do paciente antes de registrar a chegada.",
      );
    }
  }

  if (args.para === "finalizado" && de !== "finalizado") {
    try {
      await alterarAgendamentoHandler(supabase, ctx, { id: args.appointmentId, status: "completed" });
    } catch (err) {
      // Atendimento que termina ANTES do horário marcado (paciente chegou cedo):
      // o núcleo recusa "Compareceu" em compromisso que ainda não começou. A
      // visita é o fato — ela finaliza, e o núcleo segue como estava.
      if (!(err instanceof ApiError && err.code === "agenda_ainda_nao_aconteceu")) throw err;
    }
  }
  if (de === "finalizado" && args.para !== "finalizado") {
    await alterarAgendamentoHandler(supabase, ctx, { id: args.appointmentId, status: "confirmed" });
  }

  const { data, error } = await supabase.rpc("fn_clinic_mudar_status_visita", {
    p_org: ctx.organization_id,
    p_appointment: args.appointmentId,
    p_status: args.para,
    p_reason: args.motivo ?? null,
  });
  if (error) {
    const conhecido = Object.entries(ERROS_DO_BANCO).find(([chave]) => error.message.includes(chave));
    if (conhecido) {
      const [, e] = conhecido;
      throw new ApiError(e.status, e.code, undefined, ctx.requestId, e.mensagem);
    }
    if (error.code === "42501") {
      throw new ApiError(403, "forbidden", undefined, ctx.requestId, "Você não tem permissão para mudar o status.");
    }
    throw new ApiError(500, "internal_error", undefined, ctx.requestId, error.message);
  }
  const r = data as { status: StatusDaVisita; de?: StatusDaVisita; mudou: boolean; correcao?: boolean };
  return { status: r.status, de: r.de ?? de, mudou: r.mudou, correcao: !!r.correcao };
}
