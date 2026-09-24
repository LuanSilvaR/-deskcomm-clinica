/**
 * FORK clinic (épico E1.3) — o primeiro horário livre de cada profissional que
 * pode fazer o atendimento, do mais cedo para o mais tarde.
 *
 * Usa a MESMA consulta da grade e da IA (`horariosLivresDaOrg`): jornada,
 * exceções, bloqueios clinic, especialidade, ocupação e Google. Uma conta
 * paralela aqui diria à recepção um horário que a grade e o agente não oferecem.
 *
 * Quem pode atender: os habilitados do tipo (especialidade exigida); quando o
 * tipo não exige especialidade, quem publicou jornada na organização.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { horariosLivresDaOrg } from "@/lib/agenda/consulta";
import { profissionaisHabilitados } from "@/lib/clinic/profissionais/habilitacao";

/** Até quantos dias à frente procurar. */
export const DIAS_DE_BUSCA = 30;
/** Teto de profissionais consultados por pedido (cada um é uma consulta de agenda). */
export const MAXIMO_DE_PROFISSIONAIS = 30;

export interface ProximoLivre {
  profissional_id: string;
  inicio: string;
  fim: string;
}

export interface ResultadoDosProximos {
  proximos: ProximoLivre[];
  /** Quem pode atender, mas não tem horário livre no período. */
  sem_horario: string[];
}

/** Do mais cedo para o mais tarde; empate pelo id, para a lista não trocar de ordem sozinha. */
export function ordenarProximos(lista: readonly ProximoLivre[]): ProximoLivre[] {
  return [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.profissional_id.localeCompare(b.profissional_id));
}

export async function candidatosDoTipo(
  supabase: SupabaseClient,
  organizationId: string,
  eventTypeId: string,
): Promise<{ ok: true; userIds: string[] } | { ok: false; erro: string }> {
  const habilitados = await profissionaisHabilitados(supabase, organizationId, eventTypeId);
  if (!habilitados.ok) return habilitados;
  if (habilitados.userIds !== null) return { ok: true, userIds: habilitados.userIds.slice(0, MAXIMO_DE_PROFISSIONAIS) };

  const { data, error } = await supabase
    .from("attendant_availability")
    .select("user_id")
    .eq("organization_id", organizationId)
    .limit(MAXIMO_DE_PROFISSIONAIS);
  if (error) return { ok: false, erro: error.message };
  return { ok: true, userIds: [...new Set(((data ?? []) as { user_id: string }[]).map((l) => l.user_id))] };
}

export async function proximosLivres(
  supabase: SupabaseClient,
  organizationId: string,
  args: { eventTypeId: string; candidatos: readonly string[]; agora: Date },
): Promise<ResultadoDosProximos> {
  const de = args.agora;
  const ate = new Date(de.getTime() + DIAS_DE_BUSCA * 86_400_000);
  const respostas = await Promise.all(
    args.candidatos.map(async (id) => {
      const consulta = await horariosLivresDaOrg(supabase, organizationId, {
        eventTypeId: args.eventTypeId,
        eventTypeSlug: null,
        ownerUserId: id,
        de,
        ate,
        agora: args.agora,
      });
      if (!consulta.ok || consulta.slots.length === 0) return { id, primeiro: null };
      const primeiro = consulta.slots.reduce((a, b) => (b.inicio.getTime() < a.inicio.getTime() ? b : a));
      return { id, primeiro };
    }),
  );
  const proximos: ProximoLivre[] = [];
  const semHorario: string[] = [];
  for (const r of respostas) {
    if (r.primeiro) proximos.push({ profissional_id: r.id, inicio: r.primeiro.inicio.toISOString(), fim: r.primeiro.fim.toISOString() });
    else semHorario.push(r.id);
  }
  return { proximos: ordenarProximos(proximos), sem_horario: semHorario };
}
