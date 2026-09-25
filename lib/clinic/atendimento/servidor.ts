/**
 * FORK clinic (prontuário F1) — iniciar e finalizar o atendimento.
 *
 * As regras que importam moram no banco (`fn_clinic_iniciar_atendimento`,
 * `fn_clinic_finalizar_atendimento`, migration 9017): permissão clínica, MFA,
 * suporte com escrita, opção `prontuario` ligada, agendamento da empresa.
 * Aqui só se traduz o erro do banco e se encadeia a visita/"Compareceu".
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { HandlerCtx } from "@/lib/api/handlers/types";
import { ApiError } from "@/lib/api/types";
import { mudarStatusDaVisita } from "@/lib/clinic/visitas/mudar-status";
import { createAdminClient } from "@/lib/supabase/admin";

const ERROS_DO_BANCO: Record<string, { status: number; code: string; mensagem: string }> = {
  prontuario_desligado: {
    status: 409,
    code: "prontuario_desligado",
    mensagem: "O módulo de prontuário está desligado nesta clínica.",
  },
  atendimento_agendamento_nao_encontrado: {
    status: 404,
    code: "not_found",
    mensagem: "Agendamento não encontrado.",
  },
  atendimento_nao_encontrado: {
    status: 404,
    code: "not_found",
    mensagem: "Atendimento não encontrado.",
  },
  atendimento_sem_paciente: {
    status: 422,
    code: "validation_failed",
    mensagem: "Este agendamento não tem paciente vinculado.",
  },
  atendimento_agendamento_cancelado: {
    status: 422,
    code: "validation_failed",
    mensagem: "Este agendamento foi cancelado ou o paciente faltou.",
  },
  atendimento_especialidade_invalida: {
    status: 422,
    code: "validation_failed",
    mensagem: "Escolha uma especialidade que você atende.",
  },
  atendimento_ja_encerrado: {
    status: 409,
    code: "atendimento_ja_encerrado",
    mensagem: "Este atendimento já foi encerrado.",
  },
  requisitos_pendentes: {
    status: 422,
    code: "requisitos_pendentes",
    mensagem: "Faltam registros obrigatórios para finalizar o atendimento.",
  },
  registro_conflito: {
    status: 409,
    code: "conflict",
    mensagem: "Outra pessoa alterou este registro. Recarregue para ver a versão mais nova.",
  },
  prontuario_imutavel: {
    status: 409,
    code: "prontuario_imutavel",
    mensagem: "Registro finalizado não pode ser alterado. Use um adendo.",
  },
  formulario_modelo_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Modelo de formulário inválido para esta seção.",
  },
  formulario_respostas_invalidas: {
    status: 422,
    code: "validation_failed",
    mensagem: "Respostas inválidas.",
  },
  adendo_so_em_finalizado: {
    status: 409,
    code: "conflict",
    mensagem: "Adendo só vale para atendimento finalizado. Enquanto está aberto, edite o registro.",
  },
  adendo_alvo_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "O registro do adendo não é deste atendimento.",
  },
  adendo_sem_motivo: {
    status: 422,
    code: "validation_failed",
    mensagem: "Informe o motivo do adendo.",
  },
  // FORK clinic (prontuário F3, 9020). Depois de `formulario_modelo_invalido`:
  // a busca é por trecho e a primeira que casa vence.
  modelo_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Os campos do modelo são inválidos: confira chaves, tipos e especialidades.",
  },
  modelo_nome_em_uso: {
    status: 409,
    code: "conflict",
    mensagem: "Já existe um modelo com este nome.",
  },
  modelo_nao_encontrado: { status: 404, code: "not_found", mensagem: "Modelo não encontrado." },
  requisitos_invalidos: {
    status: 422,
    code: "validation_failed",
    mensagem: "Regras inválidas: confira o tipo de atendimento e a especialidade.",
  },
  // FORK clinic (prontuário F4, 9021).
  plano_paciente_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Paciente inválido para este plano.",
  },
  plano_nao_encontrado: { status: 404, code: "not_found", mensagem: "Plano não encontrado." },
  plano_sessao_nao_encontrada: {
    status: 404,
    code: "not_found",
    mensagem: "Sessão não encontrada.",
  },
  plano_encerrado: {
    status: 409,
    code: "conflict",
    mensagem: "Este plano está concluído ou cancelado.",
  },
  plano_sessao_encerrada: {
    status: 409,
    code: "conflict",
    mensagem: "Esta sessão já foi realizada ou cancelada.",
  },
  plano_agendamento_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "O agendamento precisa ser deste paciente e não pode estar cancelado.",
  },
  plano_agendamento_em_uso: {
    status: 409,
    code: "conflict",
    mensagem: "Este agendamento já está ligado a outra sessão.",
  },
  plano_sessao_sem_motivo: {
    status: 422,
    code: "validation_failed",
    mensagem: "Informe o motivo do cancelamento.",
  },
  plano_invalido: { status: 422, code: "validation_failed", mensagem: "Dados do plano inválidos." },
  // FORK clinic (prontuário F5, 9022).
  procedimento_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Procedimento inválido: confira o procedimento, o serviço e os produtos.",
  },
  procedimento_nao_encontrado: {
    status: 404,
    code: "not_found",
    mensagem: "Procedimento não encontrado.",
  },
  procedimento_sem_motivo: {
    status: 422,
    code: "validation_failed",
    mensagem: "Informe o motivo para anular.",
  },
  // FORK clinic (prontuário F6, 9023). `documento_modelo_*` antes de `documento_*`.
  documento_modelo_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Modelo de documento inválido.",
  },
  documento_modelo_nome_em_uso: {
    status: 409,
    code: "conflict",
    mensagem: "Já existe um modelo com este nome.",
  },
  documento_modelo_nao_encontrado: {
    status: 404,
    code: "not_found",
    mensagem: "Modelo não encontrado.",
  },
  documento_imutavel: {
    status: 409,
    code: "conflict",
    mensagem: "Documento emitido não pode ser alterado.",
  },
  documento_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Não foi possível emitir: confira o paciente e o modelo.",
  },
  documento_nao_encontrado: {
    status: 404,
    code: "not_found",
    mensagem: "Documento não encontrado.",
  },
  documento_ja_respondido: {
    status: 409,
    code: "conflict",
    mensagem: "Este documento já foi respondido, revogado ou cancelado.",
  },
  documento_sem_nome: {
    status: 422,
    code: "validation_failed",
    mensagem: "Digite o nome completo de quem aceita.",
  },
  documento_escolhas_invalidas: {
    status: 422,
    code: "validation_failed",
    mensagem: "Responda sim ou não em cada opção. As obrigatórias precisam estar marcadas.",
  },
  documento_sem_motivo: { status: 422, code: "validation_failed", mensagem: "Informe o motivo." },
  documento_link_invalido: {
    status: 410,
    code: "token_expired",
    mensagem: "Este link expirou ou já foi usado.",
  },
  // FORK clinic (prontuário F7, 9024).
  anexo_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Arquivo inválido para este paciente.",
  },
  anexo_cota_excedida: {
    status: 413,
    code: "payload_too_large",
    mensagem:
      "A clínica atingiu o limite de espaço para arquivos. Fale com quem administra o sistema.",
  },
  anexo_nao_encontrado: { status: 404, code: "not_found", mensagem: "Arquivo não encontrado." },
  anexo_sem_motivo: {
    status: 422,
    code: "validation_failed",
    mensagem: "Informe o motivo para anular.",
  },
  anexo_sem_autorizacao_de_imagem: {
    status: 403,
    code: "forbidden_permission",
    mensagem:
      "O paciente não autorizou este uso da imagem (ou a autorização venceu ou foi revogada).",
  },
  // FORK clinic (prontuário F8, 9025).
  atendimento_sem_motivo: { status: 422, code: "validation_failed", mensagem: "Informe o motivo." },
  atendimento_nao_finalizado: {
    status: 409,
    code: "conflict",
    mensagem: "Só um atendimento finalizado pode ser reaberto.",
  },
  // FORK clinic (prontuário F9, 9026).
  cabecalho_paciente_invalido: {
    status: 422,
    code: "validation_failed",
    mensagem: "Paciente inválido.",
  },
  atendimento_com_registros: {
    status: 409,
    code: "conflict",
    mensagem:
      "Este atendimento já tem registros clínicos: finalize e corrija por adendo em vez de anular.",
  },
  // F10 (9027)
  anexo_canal_obrigatorio: {
    status: 422,
    code: "validation_failed",
    mensagem: "Escolha em quais canais a foto pode ser divulgada.",
  },
  documento_opcao_obrigatoria_imagem: {
    status: 422,
    code: "validation_failed",
    mensagem: "No termo de uso de imagem nenhuma opção pode ser obrigatória: o paciente escolhe cada uma livremente.",
  },
  acesso_mfa_exigido: {
    status: 403,
    code: "mfa_required",
    mensagem: "Confirme a verificação em duas etapas para continuar.",
  },
  acesso_proibido: {
    status: 403,
    code: "forbidden_permission",
    mensagem: "Você não tem permissão para esta ação.",
  },
};

export function erroDoBanco(
  error: { message: string; code?: string; details?: string | null },
  requestId: string,
): ApiError {
  const conhecido = Object.entries(ERROS_DO_BANCO).find(([chave]) => error.message.includes(chave));
  if (conhecido) {
    const [chave, e] = conhecido;
    // `requisitos_pendentes` traz no detail a lista do que falta (ex.: "evolucao,anamnese").
    const details =
      chave === "requisitos_pendentes" && error.details
        ? { faltando: error.details.split(",").filter(Boolean) }
        : undefined;
    return new ApiError(e.status, e.code, details, requestId, e.mensagem);
  }
  return new ApiError(500, "internal_error", undefined, requestId, error.message);
}

export async function iniciarAtendimento(
  supabase: SupabaseClient,
  ctx: HandlerCtx,
  args: { appointmentId: string; especialidadeId?: string | null },
): Promise<{ id: string; criado: boolean }> {
  const { data, error } = await supabase.rpc("fn_clinic_iniciar_atendimento", {
    p_org: ctx.organization_id,
    p_appointment: args.appointmentId,
    p_specialty: args.especialidadeId ?? null,
  });
  if (error) throw erroDoBanco(error, ctx.requestId);
  return data as { id: string; criado: boolean };
}

export async function finalizarAtendimento(
  supabase: SupabaseClient,
  ctx: HandlerCtx,
  args: { atendimentoId: string },
): Promise<{ id: string; mudou: boolean }> {
  const { data: at, error: e1 } = await supabase
    .from("clinic_atendimentos")
    .select("id, status, appointment_id, contact_id")
    .eq("organization_id", ctx.organization_id)
    .eq("id", args.atendimentoId)
    .maybeSingle();
  if (e1) throw new ApiError(500, "internal_error", undefined, ctx.requestId, e1.message);
  if (!at)
    throw new ApiError(404, "not_found", undefined, ctx.requestId, "Atendimento não encontrado.");

  // O registro clínico primeiro: é ele que pode recusar (requisitos pendentes).
  const { data, error } = await supabase.rpc("fn_clinic_finalizar_atendimento", {
    p_org: ctx.organization_id,
    p_atendimento: args.atendimentoId,
  });
  if (error) throw erroDoBanco(error, ctx.requestId);
  const r = data as { id: string; mudou: boolean };

  // Depois a visita e o "Compareceu" do núcleo, pelo mesmo caminho da recepção.
  // Idempotente: se este passo falhar, finalizar de novo o completa.
  if (at.appointment_id) {
    await mudarStatusDaVisita(supabase, ctx, {
      appointmentId: at.appointment_id as string,
      contactId: (at.contact_id as string | null) ?? null,
      para: "finalizado",
    });
  }
  return { id: r.id, mudou: r.mudou };
}

/**
 * O agendamento tem atendimento aberto? Consulta pelo service role, com a
 * empresa vinda do contexto autenticado (nunca do corpo) e devolvendo SÓ um
 * booleano: a recepção não lê atendimento (dado clínico), mas precisa saber
 * que não é ela quem conclui.
 */
export async function temAtendimentoAberto(
  organizationId: string,
  appointmentId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("clinic_atendimentos")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("appointment_id", appointmentId)
    .eq("status", "em_andamento");
  return !error && (count ?? 0) > 0;
}
