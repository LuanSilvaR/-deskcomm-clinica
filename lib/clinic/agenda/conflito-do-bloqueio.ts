/**
 * FORK clinic (agenda S5, PF18–PF19) — o bloqueio que cairia em cima de
 * paciente marcado. Pura: recebe o bloqueio, os agendamentos ativos do dono
 * (pendente/confirmado) e o fuso da clínica; devolve os que colidem.
 *
 * Reaproveita a travessia do motor (`bloqueiosComoExcecoes`): um dia de
 * calendário por vez, no fuso da clínica. Agendamento que atravessa a
 * meia-noite conta até o fim do dia em que começa (a agenda não marca assim).
 */
import { partesNoFuso } from "@/lib/agenda/fuso";

import { type BloqueioDaClinica, bloqueiosComoExcecoes } from "./expandir-bloqueios";

/** `clinic_agenda_blocks.tipo` (migration 9044). */
export const TIPOS_DE_BLOQUEIO = ["almoco", "reuniao", "pessoal", "indisponivel", "outro"] as const;
export type TipoDeBloqueio = (typeof TIPOS_DE_BLOQUEIO)[number];
export const ROTULO_DO_TIPO_DE_BLOQUEIO: Record<TipoDeBloqueio, string> = {
  almoco: "Almoço",
  reuniao: "Reunião",
  pessoal: "Pessoal",
  indisponivel: "Indisponível",
  outro: "Outro",
};

export interface AgendamentoAtivo {
  id: string;
  starts_at: string;
  ends_at: string;
}

const dois = (n: number) => String(n).padStart(2, "0");

export function conflitosDoBloqueio<T extends AgendamentoAtivo>(
  bloqueio: BloqueioDaClinica,
  donoId: string,
  agendamentos: readonly T[],
  fuso: string,
): T[] {
  const porDia = new Map<string, { inicio: number; fim: number }[]>();
  for (const e of bloqueiosComoExcecoes([bloqueio], donoId, bloqueio.starts_on, bloqueio.ends_on)) {
    const l = porDia.get(e.data) ?? [];
    l.push({ inicio: e.inicioMinuto ?? 0, fim: e.fimMinuto ?? 1440 });
    porDia.set(e.data, l);
  }
  return agendamentos.filter((a) => {
    const ini = partesNoFuso(new Date(a.starts_at), fuso);
    const fim = partesNoFuso(new Date(a.ends_at), fuso);
    const dia = `${ini.ano}-${dois(ini.mes)}-${dois(ini.dia)}`;
    const mesmoDia = fim.ano === ini.ano && fim.mes === ini.mes && fim.dia === ini.dia;
    const de = ini.hora * 60 + ini.minuto;
    const ate = mesmoDia ? fim.hora * 60 + fim.minuto : 1440;
    return (porDia.get(dia) ?? []).some((f) => de < f.fim && ate > f.inicio);
  });
}
