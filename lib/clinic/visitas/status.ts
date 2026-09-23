/**
 * O STATUS DA VISITA do paciente agendado (migration 9003) — vocabulário, rótulos
 * e o próximo passo. Fonte única para rota, tela e painel da recepção; o CHECK do
 * banco (`clinic_appointment_visits_status_check`) espelha esta lista.
 *
 *   agendado        o compromisso está marcado (ou a chegada foi desfeita)
 *   na_recepcao     o paciente chegou e está com a recepção
 *   pronto          a recepção terminou: o profissional pode chamar
 *   em_atendimento  o profissional começou
 *   finalizado      o profissional terminou (grava `completed` no núcleo)
 */
export const STATUS_DA_VISITA = ["agendado", "na_recepcao", "pronto", "em_atendimento", "finalizado"] as const;
export type StatusDaVisita = (typeof STATUS_DA_VISITA)[number];

export const ROTULO_DO_STATUS: Record<StatusDaVisita, string> = {
  agendado: "Agendado",
  na_recepcao: "Na recepção",
  pronto: "Pronto para atendimento",
  em_atendimento: "Em atendimento",
  finalizado: "Finalizado",
};

/** O botão que leva ao próximo estado — o texto é a AÇÃO, não o estado. */
export const ACAO_PARA_AVANCAR: Record<StatusDaVisita, { para: StatusDaVisita; rotulo: string } | null> = {
  agendado: { para: "na_recepcao", rotulo: "Paciente chegou" },
  na_recepcao: { para: "pronto", rotulo: "Pronto para atendimento" },
  pronto: { para: "em_atendimento", rotulo: "Iniciar atendimento" },
  em_atendimento: { para: "finalizado", rotulo: "Finalizar atendimento" },
  finalizado: null,
};

export function ehStatusDaVisita(v: unknown): v is StatusDaVisita {
  return typeof v === "string" && (STATUS_DA_VISITA as readonly string[]).includes(v);
}

/** Voltar na ordem é CORREÇÃO: o banco exige motivo (≥ 3 caracteres). */
export function ehCorrecao(de: StatusDaVisita, para: StatusDaVisita): boolean {
  return STATUS_DA_VISITA.indexOf(para) < STATUS_DA_VISITA.indexOf(de);
}
