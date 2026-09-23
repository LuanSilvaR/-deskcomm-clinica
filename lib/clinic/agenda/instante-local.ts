/**
 * Um instante (ISO) → a data e o minuto do dia NA PAREDE de um fuso.
 *
 * O bloqueio da clínica é guardado em dia de calendário + minutos locais (a
 * mesma régua das exceções). Quem bloqueia pela grade clica num INSTANTE; esta
 * função faz a travessia com o fuso da REGRA (o da jornada do profissional),
 * nunca o do navegador — em produção o servidor roda em UTC e a pessoa pode
 * estar noutro fuso.
 */
export function instanteNaParede(instante: string, fuso: string): { data: string; minuto: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instante));
  const v = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return {
    data: `${v("year")}-${v("month")}-${v("day")}`,
    minuto: Number(v("hour")) * 60 + Number(v("minute")),
  };
}

/** A faixa [início, fim) em minutos locais, sem passar da meia-noite. */
export function faixaDoBloqueio(minutoInicial: number, duracaoMin: number): { start_minute: number; end_minute: number } {
  const fim = Math.min(1440, minutoInicial + Math.max(5, duracaoMin));
  return { start_minute: minutoInicial, end_minute: fim };
}
