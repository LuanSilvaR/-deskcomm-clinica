/**
 * FORK clinic (Agenda do dia) — o dia de cada profissional em LISTA: ocupação,
 * estado do dia, compromissos com o status de exibição e os horários livres.
 *
 * Puro: recebe as colunas de `montarColunas` (dia-por-profissional.ts) e o que
 * o banco devolveu sobre visitas, confirmações, faltas e fichas. A régua de
 * minutos é a do dia LOCAL da organização (0–1440).
 *
 * Horário livre aqui é um PASSO da jornada (30 min por padrão) inteiro dentro
 * da jornada, fora de bloqueio e sem compromisso. É o que a recepção enxerga
 * para encaixar o olho; quem decide a vaga de verdade ao marcar continua sendo
 * o motor de horários livres (duração, intervalo, salas e equipamentos).
 */
import { statusDeExibicao, type StatusDeExibicao } from "@/lib/clinic/visitas/exibicao";

import type { ColunaDoProfissional, FaixaBloqueada } from "./dia-por-profissional";

export interface FichaDoProfissional {
  nome: string | null;
  conselho: string | null;
  especialidades: { id: string; nome: string }[];
}

export interface LinhaDeCompromisso {
  tipo: "compromisso";
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  inicio_minuto: number;
  fim_minuto: number;
  paciente: string | null;
  paciente_id: string | null;
  status: StatusDeExibicao;
  /** Desde quando está no status da visita (para "na recepção há 12 min"). */
  desde: string | null;
  confirmacao: string | null;
  faltas: number;
}

export interface LinhaLivre {
  tipo: "livre";
  inicio_minuto: number;
  fim_minuto: number;
  /** Já passou (hoje, antes de agora): a tela esmaece e o "somente livres" esconde. */
  passou: boolean;
}

export type LinhaDoDia = LinhaDeCompromisso | LinhaLivre;

export type EstadoDoDia = "disponivel" | "lotado" | "bloqueado" | "fora_da_jornada";

export interface BlocoDoProfissional {
  profissional_id: string;
  ficha: FichaDoProfissional | null;
  estado: EstadoDoDia;
  ocupacao: { consultas: number; minutos_ocupados: number; minutos_abertos: number; livres: number };
  bloqueios: FaixaBloqueada[];
  linhas: LinhaDoDia[];
}

export interface Visita {
  status: string;
  desde: string | null;
}

/** "HH:MM" e a data local de um instante, no fuso da organização. */
function partesLocais(iso: string, fuso: string): { dia: string; minuto: number } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return { dia: `${v("year")}-${v("month")}-${v("day")}`, minuto: Number(v("hour")) * 60 + Number(v("minute")) };
}

/** O minuto do dia `dia` em que o instante cai; antes do dia = 0, depois = 1440. */
export function minutoNoDia(iso: string, dia: string, fuso: string): number {
  const l = partesLocais(iso, fuso);
  if (l.dia < dia) return 0;
  if (l.dia > dia) return 1440;
  return l.minuto;
}

function marcar(mapa: Uint8Array, de: number, ate: number, valor: number): void {
  for (let m = Math.max(0, de); m < Math.min(1440, ate); m++) mapa[m] = valor;
}

export function montarAgendaDoDia(args: {
  dia: string;
  fuso: string;
  colunas: readonly ColunaDoProfissional[];
  visitas: ReadonlyMap<string, Visita>;
  confirmacoes: ReadonlyMap<string, string>;
  faltas: ReadonlyMap<string, number>;
  fichas: ReadonlyMap<string, FichaDoProfissional>;
  /** Tamanho do horário livre, em minutos. */
  passo?: number;
  /** Minuto local de agora, se `dia` for hoje; null para outros dias. */
  agoraMinuto?: number | null;
}): BlocoDoProfissional[] {
  const passo = Math.max(5, Math.min(240, args.passo ?? 30));
  return args.colunas.map((col) => {
    // 0 = fora, 1 = aberto (jornada sem bloqueio), 2 = ocupado
    const mapa = new Uint8Array(1440);
    for (const j of col.jornada) marcar(mapa, j.inicio_minuto, j.fim_minuto, 1);
    for (const b of col.bloqueios) marcar(mapa, b.inicio_minuto, b.fim_minuto, 0);
    const minutosAbertos = mapa.reduce((n, v) => n + (v === 1 ? 1 : 0), 0);

    const compromissos: LinhaDeCompromisso[] = col.compromissos.map((c) => {
      const visita = args.visitas.get(c.id);
      const status = statusDeExibicao(c.status, visita?.status);
      return {
        tipo: "compromisso",
        id: c.id,
        titulo: c.titulo,
        inicio: c.inicio,
        fim: c.fim,
        inicio_minuto: minutoNoDia(c.inicio, args.dia, args.fuso),
        fim_minuto: minutoNoDia(c.fim, args.dia, args.fuso),
        paciente: c.paciente,
        paciente_id: c.paciente_id,
        status,
        desde: visita?.desde ?? null,
        confirmacao: args.confirmacoes.get(c.id) ?? null,
        faltas: c.paciente_id ? (args.faltas.get(c.paciente_id) ?? 0) : 0,
      };
    });

    let minutosOcupados = 0;
    for (const c of compromissos) {
      if (c.status === "cancelado") continue;
      for (let m = Math.max(0, c.inicio_minuto); m < Math.min(1440, c.fim_minuto); m++) {
        if (mapa[m] === 1) minutosOcupados++;
        mapa[m] = 2;
      }
    }

    const livres: LinhaLivre[] = [];
    for (const j of col.jornada) {
      for (let s = j.inicio_minuto; s + passo <= j.fim_minuto; s += passo) {
        let cabe = true;
        for (let m = s; m < s + passo; m++) {
          if (mapa[m] !== 1) {
            cabe = false;
            break;
          }
        }
        if (cabe) livres.push({ tipo: "livre", inicio_minuto: s, fim_minuto: s + passo, passou: args.agoraMinuto != null && s < args.agoraMinuto });
      }
    }
    const livresAFrente = livres.filter((l) => !l.passou).length;

    const estado: EstadoDoDia =
      col.jornada.length === 0 ? "fora_da_jornada" : minutosAbertos === 0 ? "bloqueado" : livresAFrente === 0 ? "lotado" : "disponivel";

    const linhas: LinhaDoDia[] = [...compromissos, ...livres].sort(
      (a, b) => a.inicio_minuto - b.inicio_minuto || (a.tipo === "livre" ? 1 : 0) - (b.tipo === "livre" ? 1 : 0),
    );

    return {
      profissional_id: col.profissional_id,
      ficha: args.fichas.get(col.profissional_id) ?? null,
      estado,
      ocupacao: {
        consultas: compromissos.filter((c) => c.status !== "cancelado").length,
        minutos_ocupados: minutosOcupados,
        minutos_abertos: minutosAbertos,
        livres: livresAFrente,
      },
      bloqueios: col.bloqueios,
      linhas,
    };
  });
}

/** "CRM 12345/MS" — o conselho como a clínica escreve; null sem conselho. */
export function textoDoConselho(conselho: string | null, numero: string | null, uf: string | null): string | null {
  if (!conselho) return null;
  const sigla = conselho === "outro" ? "" : conselho;
  return [sigla, [numero, uf].filter(Boolean).join("/")].filter(Boolean).join(" ") || null;
}
