/**
 * FORK clinic (épico E6) — os indicadores da agenda num período que JÁ passou.
 *
 * Puro: recebe as linhas que o banco devolveu e calcula. Réguas:
 *   - taxa de faltas = faltas ÷ (realizados + faltas). Compromisso passado ainda
 *     `pending`/`confirmed` é "sem registro" — a equipe não disse o que houve —
 *     e fica FORA da taxa (contá-lo como presença ou falta seria inventar);
 *   - espera na recepção = chegou (arrived_at) → início do atendimento
 *     (started_at); duração = início → fim (finished_at), do status da visita;
 *   - ocupação por profissional = minutos marcados (tudo menos cancelado) ÷
 *     minutos de jornada no período. A jornada é a semanal publicada; exceções
 *     e bloqueios não descontam (o número é aproximado para cima no
 *     denominador, e a tela diz isso).
 */
export interface CompromissoDoPeriodo {
  owner_user_id: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
}

export interface VisitaDoPeriodo {
  arrived_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface JornadaSemanal {
  user_id: string;
  schedule: { windows?: { dow: number; start: string; end: string }[] | null } | null;
}

export interface IndicadoresDoProfissional {
  profissional_id: string;
  agendados: number;
  realizados: number;
  faltas: number;
  cancelados: number;
  sem_registro: number;
  taxa_de_faltas: number | null;
  minutos_marcados: number;
  minutos_de_jornada: number;
  ocupacao: number | null;
}

export interface Indicadores {
  agendados: number;
  realizados: number;
  faltas: number;
  cancelados: number;
  sem_registro: number;
  taxa_de_faltas: number | null;
  espera_media_min: number | null;
  atendimento_medio_min: number | null;
  visitas_medidas: number;
  confirmacao: { pedidos: number; confirmados: number; recusados: number; sem_resposta: number; aguardando: number };
  por_profissional: IndicadoresDoProfissional[];
}

const MIN = 60_000;

function taxa(faltas: number, realizados: number): number | null {
  const base = faltas + realizados;
  return base === 0 ? null : faltas / base;
}

function media(valores: number[]): number | null {
  return valores.length === 0 ? null : Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

function minutoDe(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Os dias de calendário do período: `primeiroDia` … `ultimoDia`, inclusive. */
export function diasDoPeriodo(primeiroDia: string, ultimoDia: string): string[] {
  const dias: string[] = [];
  const [a, m, d] = primeiroDia.split("-").map(Number);
  let t = Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1);
  const [a2, m2, d2] = ultimoDia.split("-").map(Number);
  const fim = Date.UTC(a2 ?? 1970, (m2 ?? 1) - 1, d2 ?? 1);
  for (; t <= fim && dias.length < 400; t += 86_400_000) dias.push(new Date(t).toISOString().slice(0, 10));
  return dias;
}

export function minutosDeJornada(j: JornadaSemanal | undefined, dias: readonly string[]): number {
  const janelas = j?.schedule?.windows ?? [];
  let total = 0;
  for (const dia of dias) {
    const dow = new Date(`${dia}T12:00:00Z`).getUTCDay();
    for (const w of janelas) if (w.dow === dow) total += Math.max(0, minutoDe(w.end) - minutoDe(w.start));
  }
  return total;
}

export function calcularIndicadores(args: {
  compromissos: readonly CompromissoDoPeriodo[];
  visitas: readonly VisitaDoPeriodo[];
  confirmacoes: readonly { status: string }[];
  jornadas: readonly JornadaSemanal[];
  dias: readonly string[];
}): Indicadores {
  const conta = (lista: readonly CompromissoDoPeriodo[]) => {
    let realizados = 0;
    let faltas = 0;
    let cancelados = 0;
    let semRegistro = 0;
    let minutos = 0;
    for (const c of lista) {
      if (c.status === "completed") realizados += 1;
      else if (c.status === "no_show") faltas += 1;
      else if (c.status === "cancelled") cancelados += 1;
      else semRegistro += 1;
      if (c.status !== "cancelled") minutos += Math.max(0, (new Date(c.ends_at).getTime() - new Date(c.starts_at).getTime()) / MIN);
    }
    return { agendados: lista.length, realizados, faltas, cancelados, sem_registro: semRegistro, minutos: Math.round(minutos) };
  };

  const geral = conta(args.compromissos);
  const jornadaPor = new Map(args.jornadas.map((j) => [j.user_id, j]));
  const donos = new Set<string>();
  for (const c of args.compromissos) if (c.owner_user_id) donos.add(c.owner_user_id);
  for (const j of args.jornadas) if (minutosDeJornada(j, args.dias) > 0) donos.add(j.user_id);

  const porProfissional = [...donos]
    .map((id) => {
      const k = conta(args.compromissos.filter((c) => c.owner_user_id === id));
      const jornada = minutosDeJornada(jornadaPor.get(id), args.dias);
      return {
        profissional_id: id,
        agendados: k.agendados,
        realizados: k.realizados,
        faltas: k.faltas,
        cancelados: k.cancelados,
        sem_registro: k.sem_registro,
        taxa_de_faltas: taxa(k.faltas, k.realizados),
        minutos_marcados: k.minutos,
        minutos_de_jornada: jornada,
        ocupacao: jornada > 0 ? k.minutos / jornada : null,
      };
    })
    .sort((a, b) => b.agendados - a.agendados || a.profissional_id.localeCompare(b.profissional_id));

  const esperas: number[] = [];
  const duracoes: number[] = [];
  for (const v of args.visitas) {
    if (v.arrived_at && v.started_at) {
      const e = (new Date(v.started_at).getTime() - new Date(v.arrived_at).getTime()) / MIN;
      if (e >= 0) esperas.push(e);
    }
    if (v.started_at && v.finished_at) {
      const d = (new Date(v.finished_at).getTime() - new Date(v.started_at).getTime()) / MIN;
      if (d >= 0) duracoes.push(d);
    }
  }

  const conf = { pedidos: args.confirmacoes.length, confirmados: 0, recusados: 0, sem_resposta: 0, aguardando: 0 };
  for (const c of args.confirmacoes) {
    if (c.status === "confirmado") conf.confirmados += 1;
    else if (c.status === "recusado") conf.recusados += 1;
    else if (c.status === "sem_resposta") conf.sem_resposta += 1;
    else conf.aguardando += 1;
  }

  return {
    agendados: geral.agendados,
    realizados: geral.realizados,
    faltas: geral.faltas,
    cancelados: geral.cancelados,
    sem_registro: geral.sem_registro,
    taxa_de_faltas: taxa(geral.faltas, geral.realizados),
    espera_media_min: media(esperas),
    atendimento_medio_min: media(duracoes),
    visitas_medidas: Math.max(esperas.length, duracoes.length),
    confirmacao: conf,
    por_profissional: porProfissional,
  };
}
