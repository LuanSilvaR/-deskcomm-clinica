/**
 * FORK clinic (épico E1.4) — o dia da clínica em colunas, uma por profissional.
 *
 * Puro: recebe o que o banco devolveu e monta as colunas. Quem aparece:
 *   - quem tem JORNADA naquele dia da semana (`attendant_availability`);
 *   - e quem tem compromisso no dia mesmo fora da jornada (encaixe) — esconder
 *     um compromisso marcado seria pior que mostrar uma coluna a mais.
 * Em cada coluna: a jornada, os bloqueios (da pessoa, da clínica toda e as
 * indisponibilidades do núcleo) e os compromissos, em ordem de horário.
 *
 * Datas são DIAS DE CALENDÁRIO (`YYYY-MM-DD`): o dia da semana de uma data não
 * depende de fuso, então a aritmética é em UTC (a mesma régua de
 * lib/clinic/agenda/expandir-bloqueios.ts).
 */
export interface JanelaDaJornada {
  dow: number;
  start: string;
  end: string;
}

export interface Disponibilidade {
  user_id: string;
  schedule: { timezone?: string | null; windows?: JanelaDaJornada[] | null } | null;
}

export interface ExcecaoDoNucleo {
  user_id: string;
  is_unavailable: boolean;
  start_minute: number | null;
  end_minute: number | null;
  reason: string | null;
}

export interface BloqueioComMotivo {
  user_id: string | null;
  starts_on: string;
  ends_on: string;
  start_minute: number;
  end_minute: number;
  weekdays: number[] | null;
  reason: string | null;
}

export interface CompromissoDoDia {
  id: string;
  owner_user_id: string | null;
  titulo: string;
  inicio: string;
  fim: string;
  status: string;
  paciente: string | null;
  paciente_id: string | null;
}

export type OrigemDoBloqueio = "pessoa" | "clinica" | "indisponivel";

export interface FaixaBloqueada {
  inicio_minuto: number;
  fim_minuto: number;
  motivo: string | null;
  origem: OrigemDoBloqueio;
}

export interface ColunaDoProfissional {
  profissional_id: string;
  /** Faixas da jornada no dia, em minutos do dia local. Vazia = fora da jornada (só encaixe). */
  jornada: { inicio_minuto: number; fim_minuto: number }[];
  bloqueios: FaixaBloqueada[];
  compromissos: CompromissoDoDia[];
}

function paraUtc(dia: string): number {
  const [a, m, d] = dia.slice(0, 10).split("-").map(Number);
  return Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function diaDaSemana(dia: string): number {
  return new Date(paraUtc(dia)).getUTCDay();
}

export function minutoDe(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function jornadaNoDia(d: Disponibilidade | undefined, dia: string): { inicio_minuto: number; fim_minuto: number }[] {
  const dow = diaDaSemana(dia);
  return (d?.schedule?.windows ?? [])
    .filter((w) => w.dow === dow)
    .map((w) => ({ inicio_minuto: minutoDe(w.start), fim_minuto: minutoDe(w.end) }))
    .filter((f) => f.fim_minuto > f.inicio_minuto)
    .sort((a, b) => a.inicio_minuto - b.inicio_minuto);
}

export function bloqueiosNoDia(
  profissionalId: string,
  dia: string,
  bloqueios: readonly BloqueioComMotivo[],
  excecoes: readonly ExcecaoDoNucleo[],
): FaixaBloqueada[] {
  const t = paraUtc(dia);
  const dow = diaDaSemana(dia);
  const daClinica: FaixaBloqueada[] = bloqueios
    .filter(
      (b) =>
        (b.user_id === null || b.user_id === profissionalId) &&
        paraUtc(b.starts_on) <= t &&
        t <= paraUtc(b.ends_on) &&
        (!b.weekdays || b.weekdays.length === 0 || b.weekdays.includes(dow)),
    )
    .map((b) => ({
      inicio_minuto: b.start_minute,
      fim_minuto: b.end_minute,
      motivo: b.reason,
      origem: b.user_id === null ? "clinica" : "pessoa",
    }));
  const doNucleo: FaixaBloqueada[] = excecoes
    .filter((e) => e.user_id === profissionalId && e.is_unavailable)
    .map((e) => ({ inicio_minuto: e.start_minute ?? 0, fim_minuto: e.end_minute ?? 1440, motivo: e.reason, origem: "indisponivel" }));
  return [...daClinica, ...doNucleo].sort((a, b) => a.inicio_minuto - b.inicio_minuto);
}

export function montarColunas(args: {
  dia: string;
  disponibilidades: readonly Disponibilidade[];
  excecoes: readonly ExcecaoDoNucleo[];
  bloqueios: readonly BloqueioComMotivo[];
  compromissos: readonly CompromissoDoDia[];
}): ColunaDoProfissional[] {
  const porPessoa = new Map(args.disponibilidades.map((d) => [d.user_id, d]));
  const ids = new Set<string>();
  for (const d of args.disponibilidades) if (jornadaNoDia(d, args.dia).length > 0) ids.add(d.user_id);
  for (const c of args.compromissos) if (c.owner_user_id) ids.add(c.owner_user_id);

  return [...ids].map((id) => ({
    profissional_id: id,
    jornada: jornadaNoDia(porPessoa.get(id), args.dia),
    bloqueios: bloqueiosNoDia(id, args.dia, args.bloqueios, args.excecoes),
    compromissos: args.compromissos
      .filter((c) => c.owner_user_id === id)
      .sort((a, b) => a.inicio.localeCompare(b.inicio)),
  }));
}

export function horaDoMinuto(minuto: number): string {
  const m = Math.max(0, Math.min(1440, minuto));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
