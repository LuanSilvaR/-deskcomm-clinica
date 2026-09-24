/**
 * FORK clinic (melhorias da Agenda) — os filtros da tela /app/agenda.
 *
 * Moram na URL (`esp`, `status`, `periodo`, `q`, `livres`) para o link ser
 * compartilhável e o "voltar" do navegador funcionar. O filtro de PESSOA
 * continua sendo o do núcleo (avatares, `FiltroDePessoas`). Puro e testado.
 */
import { periodoDoMinuto, PERIODOS_DO_DIA, STATUS_PADRAO_DO_FILTRO, ehStatusDeExibicao, statusDeExibicao, type PeriodoDoDia, type StatusDeExibicao } from "@/lib/clinic/visitas/exibicao";

import type { FichaDoProfissional } from "./agenda-do-dia";

export interface InfoDoCompromisso {
  paciente_id: string | null;
  visita: string | null;
  desde: string | null;
  confirmacao: string | null;
  faltas: number;
}

export interface InfoDaClinica {
  compromissos: Record<string, InfoDoCompromisso>;
  profissionais: Record<string, FichaDoProfissional>;
  pacientes_da_busca: string[] | null;
}

export interface FiltrosDaAgenda {
  especialidade: string;
  status: readonly StatusDeExibicao[];
  /** O usuário mexeu no status (senão vale o padrão: tudo menos cancelado). */
  statusMudou: boolean;
  periodos: readonly PeriodoDoDia[];
  q: string;
  soLivres: boolean;
}

const lista = (v: string | null) => (v ?? "").split(",").filter(Boolean);

export function lerFiltros(p: URLSearchParams): FiltrosDaAgenda {
  const statusDaUrl = lista(p.get("status")).filter(ehStatusDeExibicao);
  const statusMudou = p.has("status");
  return {
    especialidade: p.get("esp") ?? "",
    status: statusMudou ? statusDaUrl : STATUS_PADRAO_DO_FILTRO,
    statusMudou: statusMudou && [...statusDaUrl].sort().join() !== [...STATUS_PADRAO_DO_FILTRO].sort().join(),
    periodos: lista(p.get("periodo")).filter((x): x is PeriodoDoDia => (PERIODOS_DO_DIA as readonly string[]).includes(x)),
    q: p.get("q") ?? "",
    soLivres: p.get("livres") === "1",
  };
}

/** As chaves que "Limpar filtros" apaga (as do núcleo, como `compromisso`, ficam). */
export const CHAVES_DOS_FILTROS = ["esp", "status", "periodo", "q", "livres"] as const;

export function algumFiltroAtivo(f: FiltrosDaAgenda): boolean {
  return Boolean(f.especialidade || f.statusMudou || f.periodos.length || f.q || f.soLivres);
}

/**
 * O compromisso passa nos filtros? `situacao` é a do núcleo; a informação da
 * clínica pode faltar (ainda carregando) — aí só os filtros que não dependem
 * dela valem, para a grade não piscar vazia.
 */
export function passaNosFiltros(
  a: { id: string; situacao: string; responsavelId: string; comeca: string; origem?: string },
  f: FiltrosDaAgenda,
  info: InfoDaClinica | null | undefined,
): boolean {
  if (f.soLivres) return false;
  const inicio = new Date(a.comeca);
  if (f.periodos.length && !f.periodos.includes(periodoDoMinuto(inicio.getHours() * 60 + inicio.getMinutes()))) return false;
  if (!info) return true;
  if (f.especialidade && !(info.profissionais[a.responsavelId]?.especialidades ?? []).some((e) => e.id === f.especialidade)) return false;
  const c = info.compromissos[a.id];
  if (info.pacientes_da_busca && !(c?.paciente_id && info.pacientes_da_busca.includes(c.paciente_id))) return false;
  // Ocupação do Google não tem status de visita: some só se o filtro de status mudou.
  if (a.origem === "google_sync") return !f.statusMudou;
  // Sem mexer no status, ele não filtra: a grade já esconde o cancelado sozinha e
  // o histórico PRECISA dele (aba Cancelados). Mexeu, vale o que foi marcado.
  if (!f.statusMudou) return true;
  return f.status.includes(statusDeExibicao(a.situacao, c?.visita));
}
