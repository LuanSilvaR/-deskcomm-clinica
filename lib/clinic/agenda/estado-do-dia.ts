/**
 * FORK clinic (agenda S3 #68) — o ESTADO de um dia para marcar, no painel
 * "Novo agendamento": Disponível · Sem agenda · Bloqueado · Lotado.
 *
 *   sem jornada publicada                     → sem_agenda
 *   bloqueios cobrem toda a jornada           → bloqueado
 *   jornada com sobra, mas nenhum horário livre → lotado
 *   algum horário livre (ou ainda sem a lista) → disponivel
 *
 * `livres` = horários livres do dia, ou `null` quando a lista não foi carregada
 * para aquele dia (aí não se afirma "lotado"). Puro e testado.
 */
export type EstadoDoDia = "disponivel" | "sem_agenda" | "bloqueado" | "lotado";

export const ROTULO_DO_ESTADO_DO_DIA: Record<EstadoDoDia, string> = {
  disponivel: "Disponível",
  sem_agenda: "Sem agenda",
  bloqueado: "Bloqueado",
  lotado: "Lotado",
};

interface Faixa {
  inicio_minuto: number;
  fim_minuto: number;
}

/** Minutos da jornada que nenhum bloqueio cobre. */
function minutosLivresDaJornada(jornada: Faixa[], bloqueios: Faixa[]): number {
  let total = 0;
  for (const j of jornada) {
    const cortes = bloqueios
      .map((b) => ({ ini: Math.max(b.inicio_minuto, j.inicio_minuto), fim: Math.min(b.fim_minuto, j.fim_minuto) }))
      .filter((c) => c.fim > c.ini)
      .sort((a, b) => a.ini - b.ini);
    let cursor = j.inicio_minuto;
    for (const c of cortes) {
      if (c.ini > cursor) total += c.ini - cursor;
      cursor = Math.max(cursor, c.fim);
    }
    if (j.fim_minuto > cursor) total += j.fim_minuto - cursor;
  }
  return total;
}

export function estadoDoDia(args: { jornada: Faixa[]; bloqueios: Faixa[]; livres: number | null }): EstadoDoDia {
  if (!args.jornada.length) return "sem_agenda";
  if (minutosLivresDaJornada(args.jornada, args.bloqueios) <= 0) return "bloqueado";
  if (args.livres === 0) return "lotado";
  return "disponivel";
}
