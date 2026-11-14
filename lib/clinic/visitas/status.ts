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
  na_recepcao: "Em recepção",
  pronto: "Pronto para atendimento",
  em_atendimento: "Em atendimento",
  finalizado: "Finalizado",
};

/**
 * O botão que leva ao próximo estado — o texto é a AÇÃO, não o estado.
 *
 * FORK clinic (agenda S4, 9043): `quem` diz de quem é o passo. Chegada e pronto
 * são da RECEPÇÃO; começar e terminar o atendimento são SÓ do profissional do
 * agendamento — o banco recusa os outros (`visita_so_o_profissional`), e a tela
 * nem oferece (`podeAvancar`).
 */
export type DonoDoPasso = "recepcao" | "profissional";
export const ACAO_PARA_AVANCAR: Record<StatusDaVisita, { para: StatusDaVisita; rotulo: string; quem: DonoDoPasso } | null> = {
  agendado: { para: "na_recepcao", rotulo: "Iniciar recepção", quem: "recepcao" },
  na_recepcao: { para: "pronto", rotulo: "Pronto para atendimento", quem: "recepcao" },
  pronto: { para: "em_atendimento", rotulo: "Iniciar atendimento", quem: "profissional" },
  em_atendimento: { para: "finalizado", rotulo: "Finalizar atendimento", quem: "profissional" },
  finalizado: null,
};

/** Quem está na tela pode dar este passo? (O servidor confere de novo.) */
export function podeAvancar(
  passo: { quem: DonoDoPasso } | null,
  quem: { ehODono: boolean; podeRecepcao: boolean },
): boolean {
  if (!passo) return false;
  return passo.quem === "profissional" ? quem.ehODono : quem.podeRecepcao || quem.ehODono;
}

export function ehStatusDaVisita(v: unknown): v is StatusDaVisita {
  return typeof v === "string" && (STATUS_DA_VISITA as readonly string[]).includes(v);
}

/** Voltar na ordem é CORREÇÃO: o banco exige motivo (≥ 3 caracteres). */
export function ehCorrecao(de: StatusDaVisita, para: StatusDaVisita): boolean {
  return STATUS_DA_VISITA.indexOf(para) < STATUS_DA_VISITA.indexOf(de);
}
