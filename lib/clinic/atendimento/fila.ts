/**
 * FORK clinic (prontuário F1) — a fila "Meus atendimentos".
 *
 * Pura e testável: recebe os agendamentos do dia (com o status da visita, 9003)
 * e devolve as quatro seções na ordem em que o profissional olha:
 *
 *   aguardando      chegou (na recepção) ou está pronto — quem espera há mais
 *                   tempo primeiro
 *   em_atendimento  já começou
 *   proximos        ainda não chegou — por horário
 *   finalizados     terminou — por horário
 *
 * Não carrega conteúdo clínico: só horário, paciente, serviço e estado.
 */
import type { StatusDaVisita } from "@/lib/clinic/visitas/status";

export const SECOES_DA_FILA = ["aguardando", "em_atendimento", "proximos", "finalizados"] as const;
export type SecaoDaFila = (typeof SECOES_DA_FILA)[number];

export const ROTULO_DA_SECAO: Record<SecaoDaFila, string> = {
  aguardando: "Aguardando atendimento",
  em_atendimento: "Em atendimento",
  proximos: "Próximos",
  finalizados: "Finalizados",
};

export interface ItemDaFila {
  appointment_id: string;
  inicio: string;
  fim: string;
  paciente_id: string;
  paciente: string | null;
  servico: string | null;
  profissional_id: string | null;
  status: StatusDaVisita;
  chegou_em: string | null;
  pronto_em: string | null;
  /** Só aparece para quem pode ver o prontuário (a RLS esconde dos outros). */
  atendimento_id: string | null;
}

export interface ItemNaFila extends ItemDaFila {
  /** Minutos desde que ficou pronto (ou chegou); só na seção "aguardando". */
  espera_min: number | null;
}

export function secaoDoStatus(status: StatusDaVisita): SecaoDaFila {
  switch (status) {
    case "na_recepcao":
    case "pronto":
      return "aguardando";
    case "em_atendimento":
      return "em_atendimento";
    case "finalizado":
      return "finalizados";
    default:
      return "proximos";
  }
}

export function minutosDeEspera(item: Pick<ItemDaFila, "pronto_em" | "chegou_em">, agora: Date): number | null {
  const desde = item.pronto_em ?? item.chegou_em;
  if (!desde) return null;
  const ms = agora.getTime() - new Date(desde).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60_000)) : null;
}

export function montarFila(itens: readonly ItemDaFila[], agora: Date): Record<SecaoDaFila, ItemNaFila[]> {
  const fila: Record<SecaoDaFila, ItemNaFila[]> = { aguardando: [], em_atendimento: [], proximos: [], finalizados: [] };
  for (const item of itens) {
    const secao = secaoDoStatus(item.status);
    fila[secao].push({ ...item, espera_min: secao === "aguardando" ? minutosDeEspera(item, agora) : null });
  }
  fila.aguardando.sort((a, b) => (b.espera_min ?? -1) - (a.espera_min ?? -1) || a.inicio.localeCompare(b.inicio));
  for (const s of ["em_atendimento", "proximos", "finalizados"] as const) fila[s].sort((a, b) => a.inicio.localeCompare(b.inicio));
  return fila;
}
