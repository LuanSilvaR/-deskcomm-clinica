/**
 * FORK clinic (melhorias da Agenda) — os filtros da tela /app/agenda.
 *
 * Moram na URL (`esp`, `status`, `periodo`, `q`, `livres`; S2 #67: `sala`,
 * `cancelados`, `fds`, `indisp`; S3 #68: `proc`) para o link ser
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
  /** FORK clinic (agenda S4): nenhum atendimento realizado antes deste. */
  primeira_vez?: boolean;
  /** FORK clinic (agenda S4): mudou de horário e ninguém confirmou depois. */
  remarcado?: boolean;
  /** FORK clinic (agenda S2 #67): salas reservadas para o compromisso (`clinic_appointment_resources`). */
  salas?: string[];
  /** FORK clinic (agenda S3 #68): procedimentos do agendamento, na ordem (8016). */
  procedimentos?: string[];
}

export interface ProcedimentoDaAgenda {
  id: string;
  nome: string;
}

export interface SalaDaAgenda {
  id: string;
  nome: string;
}

export interface InfoDaClinica {
  compromissos: Record<string, InfoDoCompromisso>;
  profissionais: Record<string, FichaDoProfissional>;
  pacientes_da_busca: string[] | null;
  /** FORK clinic (agenda S2 #67): salas ativas da clínica, para o filtro. */
  salas?: SalaDaAgenda[];
  /** FORK clinic (agenda S3 #68): catálogo de procedimentos ativos. */
  procedimentos?: ProcedimentoDaAgenda[];
}

export interface FiltrosDaAgenda {
  especialidade: string;
  status: readonly StatusDeExibicao[];
  /** O usuário mexeu no status (senão vale o padrão: tudo menos cancelado). */
  statusMudou: boolean;
  periodos: readonly PeriodoDoDia[];
  q: string;
  soLivres: boolean;
  /** S2 (#67): id da sala ("" = todas). */
  sala: string;
  /** S3 (#68): id do procedimento ("" = todos). */
  procedimento: string;
  /** S2: a grade mostra também os cancelados. */
  cancelados: boolean;
  /** S2: a semana esconde sábado e domingo. */
  semFimDeSemana: boolean;
  /** S2: a grade não pinta fora do expediente nem bloqueios. */
  semIndisponiveis: boolean;
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
    sala: p.get("sala") ?? "",
    procedimento: p.get("proc") ?? "",
    cancelados: p.get("cancelados") === "1",
    semFimDeSemana: p.get("fds") === "0",
    semIndisponiveis: p.get("indisp") === "0",
  };
}

/** As chaves que "Limpar filtros" apaga (as do núcleo, como `compromisso`, ficam). */
export const CHAVES_DOS_FILTROS = ["esp", "status", "periodo", "q", "livres", "sala", "proc", "cancelados", "fds", "indisp"] as const;

export function algumFiltroAtivo(f: FiltrosDaAgenda): boolean {
  return Boolean(
    f.especialidade || f.statusMudou || f.periodos.length || f.q || f.soLivres || f.sala || f.procedimento || f.cancelados || f.semFimDeSemana || f.semIndisponiveis,
  );
}

/** Quantos filtros estão ligados (o "N filtros" do botão "+ Mais filtros" conta só os dele). */
export function filtrosExtrasAtivos(f: FiltrosDaAgenda): number {
  return [f.cancelados, f.semFimDeSemana, f.semIndisponiveis].filter(Boolean).length;
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
  if (f.sala && !(c?.salas ?? []).includes(f.sala)) return false;
  if (f.procedimento && !(c?.procedimentos ?? []).includes(f.procedimento)) return false;
  if (info.pacientes_da_busca && !(c?.paciente_id && info.pacientes_da_busca.includes(c.paciente_id))) return false;
  // Ocupação do Google não tem status de visita: some só se o filtro de status mudou.
  if (a.origem === "google_sync") return !f.statusMudou;
  // Sem mexer no status, ele não filtra: a grade já esconde o cancelado sozinha e
  // o histórico PRECISA dele (aba Cancelados). Mexeu, vale o que foi marcado.
  if (!f.statusMudou) return true;
  return f.status.includes(statusDeExibicao(a.situacao, c?.visita, { confirmacao: c?.confirmacao, remarcado: c?.remarcado }));
}
