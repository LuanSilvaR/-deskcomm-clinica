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
 */
import { ehStatusDaVisita } from "./status";

export const STATUS_DE_EXIBICAO = [
  "agendado",
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
  na_recepcao: "Na recepção",
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

export function statusDeExibicao(situacao: string | null | undefined, visita: string | null | undefined): StatusDeExibicao {
  if (situacao === "cancelled") return "cancelado";
  if (situacao === "no_show") return "faltou";
  if (ehStatusDaVisita(visita)) return visita;
  if (situacao === "completed") return "finalizado";
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
