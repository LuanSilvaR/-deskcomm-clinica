/**
 * O STATUS DE EXIBIÇÃO do compromisso na Agenda do dia — um selo só por linha.
 *
 * Junta as duas fontes que já existem, sem mudar nenhuma:
 *   - a situação do núcleo (`calendar_appointments.status`): cancelado e
 *     faltou mandam — são o fim da história;
 *   - o status da visita (9003): agendado → na recepção → pronto → em
 *     atendimento → finalizado.
 * Precedência: cancelado > faltou > visita. Compromisso `completed` sem visita
 * registrada (marcado como realizado pela agenda) aparece como finalizado.
 *
 * FORK clinic (agenda S4): antes de o paciente chegar, o compromisso ainda tem
 * dois estados que a recepção precisa ver de longe — CONFIRMADO (o núcleo em
 * `confirmed` ou o paciente respondeu a confirmação) e REMARCADO (a última
 * mudança foi de horário e ninguém confirmou depois, `clinic_agenda_historico`).
 * Na agenda aparece só este ÚLTIMO status; o histórico inteiro fica no detalhe.
 */
import { ehStatusDaVisita, type StatusDaVisita } from "./status";

export const STATUS_DE_EXIBICAO = [
  "agendado",
  "confirmado",
  "remarcado",
  "na_recepcao",
  "pronto",
  "em_atendimento",
  "finalizado",
  "faltou",
  "cancelado",
] as const;
export type StatusDeExibicao = (typeof STATUS_DE_EXIBICAO)[number];

export const ROTULO_DE_EXIBICAO: Record<StatusDeExibicao, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  remarcado: "Remarcado",
  na_recepcao: "Em recepção",
  pronto: "Pronto para atendimento",
  em_atendimento: "Em atendimento",
  finalizado: "Finalizado",
  faltou: "Faltou",
  cancelado: "Cancelado",
};

/** O filtro de status começa com tudo menos cancelado (é consulta, não trabalho do dia). */
export const STATUS_PADRAO_DO_FILTRO: readonly StatusDeExibicao[] = STATUS_DE_EXIBICAO.filter((s) => s !== "cancelado");

export function ehStatusDeExibicao(v: unknown): v is StatusDeExibicao {
  return typeof v === "string" && (STATUS_DE_EXIBICAO as readonly string[]).includes(v);
}

export interface ExtrasDoStatus {
  /** `clinic_confirmation_requests.status` (`confirmado`, `aguardando`, …). */
  confirmacao?: string | null;
  /** A última mudança foi de horário e não houve confirmação depois. */
  remarcado?: boolean;
}

/** Antes de o paciente chegar (a visita ainda não começou). */
export const ANTES_DA_CHEGADA: readonly StatusDeExibicao[] = ["agendado", "confirmado", "remarcado"];

/** O estado da VISITA por trás do status de exibição (antes da chegada = "agendado"). */
export function visitaDaExibicao(s: StatusDeExibicao): StatusDaVisita | null {
  if (ANTES_DA_CHEGADA.includes(s)) return "agendado";
  return ehStatusDaVisita(s) ? s : null;
}

export function statusDeExibicao(
  situacao: string | null | undefined,
  visita: string | null | undefined,
  extras: ExtrasDoStatus = {},
): StatusDeExibicao {
  if (situacao === "cancelled") return "cancelado";
  if (situacao === "no_show") return "faltou";
  // A visita só manda depois que o paciente chegou: "agendado" na visita é a
  // chegada desfeita, e aí valem confirmação e remarcação como antes dela.
  if (ehStatusDaVisita(visita) && visita !== "agendado") return visita;
  if (situacao === "completed") return "finalizado";
  if (extras.remarcado) return "remarcado";
  if (situacao === "confirmed" || extras.confirmacao === "confirmado") return "confirmado";
  return "agendado";
}

export type PeriodoDoDia = "manha" | "tarde" | "noite";
export const PERIODOS_DO_DIA: readonly PeriodoDoDia[] = ["manha", "tarde", "noite"];
export const ROTULO_DO_PERIODO: Record<PeriodoDoDia, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

/** Manhã antes das 12h, tarde até as 18h, noite a partir das 18h (minuto do dia local). */
export function periodoDoMinuto(minuto: number): PeriodoDoDia {
  if (minuto < 12 * 60) return "manha";
  if (minuto < 18 * 60) return "tarde";
  return "noite";
}
