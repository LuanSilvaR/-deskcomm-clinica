/**
 * Bloqueios da clínica → exceções que o motor de horários livres já entende.
 *
 * `clinic_agenda_blocks` guarda um bloqueio por PERÍODO (starts_on…ends_on), com
 * recorrência semanal opcional (`weekdays`) e alcance de uma pessoa ou da
 * CLÍNICA TODA (`user_id` null). O motor (`horariosLivres`,
 * lib/agenda/horarios-livres.ts) não conhece nada disso: ele recebe
 * `ExcecaoDeData[]`, uma por dia. Esta função faz a travessia — pura, sem banco
 * e sem relógio — e o motor segue intocado.
 *
 * As datas são DIAS DE CALENDÁRIO (`YYYY-MM-DD`), a mesma régua de
 * `exception_date`: o dia da semana de uma data de calendário não depende de
 * fuso, então a aritmética é feita em UTC só para andar de um dia ao outro.
 */
import type { ExcecaoDeData } from "@/lib/agenda/horarios-livres";

export interface BloqueioDaClinica {
  /** null = vale para todos os profissionais da organização. */
  user_id: string | null;
  starts_on: string;
  ends_on: string;
  start_minute: number;
  end_minute: number;
  /** null = todos os dias do período; senão 0=domingo … 6=sábado. */
  weekdays: number[] | null;
}

const DIA_MS = 86_400_000;

function paraUtc(dia: string): number {
  const [a, m, d] = dia.slice(0, 10).split("-").map(Number);
  return Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function paraDia(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * As exceções de INDISPONIBILIDADE que os bloqueios geram para `donoId` entre
 * `primeiroDia` e `ultimoDia` (inclusive). Bloqueio de outro profissional é
 * ignorado; bloqueio da clínica toda vale para qualquer dono.
 */
export function bloqueiosComoExcecoes(
  bloqueios: readonly BloqueioDaClinica[],
  donoId: string,
  primeiroDia: string,
  ultimoDia: string,
): ExcecaoDeData[] {
  const inicioDaJanela = paraUtc(primeiroDia);
  const fimDaJanela = paraUtc(ultimoDia);
  if (fimDaJanela < inicioDaJanela) return [];

  const excecoes: ExcecaoDeData[] = [];
  for (const b of bloqueios) {
    if (b.user_id !== null && b.user_id !== donoId) continue;
    const dias = b.weekdays && b.weekdays.length > 0 ? new Set(b.weekdays) : null;
    const de = Math.max(paraUtc(b.starts_on), inicioDaJanela);
    const ate = Math.min(paraUtc(b.ends_on), fimDaJanela);
    for (let t = de; t <= ate; t += DIA_MS) {
      if (dias && !dias.has(new Date(t).getUTCDay())) continue;
      excecoes.push({
        data: paraDia(t),
        indisponivel: true,
        inicioMinuto: b.start_minute,
        fimMinuto: b.end_minute,
      });
    }
  }
  return excecoes;
}
