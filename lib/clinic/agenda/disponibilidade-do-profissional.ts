/**
 * FORK clinic (agenda por profissional, S1) — a disponibilidade de UM
 * profissional, dia a dia, para a grade desenhar o que não é horário livre:
 * fora da jornada (hachura) e bloqueios (bloco sólido, distinto de compromisso).
 *
 * Puro. Reusa as mesmas regras do "Dia por profissional"
 * (`jornadaNoDia`, `bloqueiosNoDia`): a grade e a lista nunca discordam sobre
 * quando alguém atende. A régua é o minuto do dia LOCAL da organização (0–1440).
 */
import {
  bloqueiosNoDia,
  jornadaNoDia,
  type BloqueioComMotivo,
  type Disponibilidade,
  type ExcecaoDoNucleo,
  type FaixaBloqueada,
} from "./dia-por-profissional";

export interface FaixaDeMinutos {
  inicio_minuto: number;
  fim_minuto: number;
}

export interface DisponibilidadeDoDia {
  dia: string;
  /** Faixas de atendimento publicadas (antes dos bloqueios). */
  jornada: FaixaDeMinutos[];
  /** O complemento da jornada no dia: o que a grade hachura. */
  fora_da_jornada: FaixaDeMinutos[];
  bloqueios: FaixaBloqueada[];
}

export const MAXIMO_DE_DIAS_DA_DISPONIBILIDADE = 42;

/** Os dias de `de` a `ate` (inclusive), AAAA-MM-DD. */
export function diasEntre(de: string, ate: string): string[] {
  const dias: string[] = [];
  const d = new Date(`${de}T00:00:00Z`);
  const fim = new Date(`${ate}T00:00:00Z`);
  while (d <= fim && dias.length < MAXIMO_DE_DIAS_DA_DISPONIBILIDADE) {
    dias.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dias;
}

/** O que sobra do dia (0–1440) fora das faixas dadas. */
export function complementoNoDia(faixas: readonly FaixaDeMinutos[]): FaixaDeMinutos[] {
  const ordenadas = [...faixas].sort((a, b) => a.inicio_minuto - b.inicio_minuto);
  const fora: FaixaDeMinutos[] = [];
  let cursor = 0;
  for (const f of ordenadas) {
    if (f.inicio_minuto > cursor) fora.push({ inicio_minuto: cursor, fim_minuto: f.inicio_minuto });
    cursor = Math.max(cursor, f.fim_minuto);
  }
  if (cursor < 1440) fora.push({ inicio_minuto: cursor, fim_minuto: 1440 });
  return fora;
}

export function disponibilidadeDoProfissional(args: {
  profissionalId: string;
  dias: readonly string[];
  disponibilidade: Disponibilidade | undefined;
  /** Exceções do núcleo já com a data de cada uma. */
  excecoes: readonly (ExcecaoDoNucleo & { exception_date: string })[];
  bloqueios: readonly BloqueioComMotivo[];
}): DisponibilidadeDoDia[] {
  return args.dias.map((dia) => {
    const jornada = jornadaNoDia(args.disponibilidade, dia);
    return {
      dia,
      jornada,
      fora_da_jornada: complementoNoDia(jornada),
      bloqueios: bloqueiosNoDia(
        args.profissionalId,
        dia,
        args.bloqueios,
        args.excecoes.filter((e) => e.exception_date === dia),
      ),
    };
  });
}
