/**
 * FORK clinic (9014) — o "Resumo do dia" do Início.
 *
 * Quatro contagens, cada uma com a MESMA porta da tela de onde vem: só é
 * consultada se a pessoa vê aquela tela no menu (`vê`), e a consulta usa o
 * client da SESSÃO — a RLS continua sendo quem decide que linhas entram na
 * conta. Nenhuma tabela nova, nenhum dado de paciente sai daqui: só números.
 *
 * Nunca lança. Bloco que falha ou que a pessoa não pode ver volta `undefined` e
 * some da tela, sem derrubar o Início.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { primeiroInstanteDoDia } from "@/lib/agenda/google/tempo";
import { somarDias } from "@/lib/automation/gatilho-de-data-do-funil";

export const FUSO_PADRAO = "America/Sao_Paulo";

export interface ResumoDoDia {
  /** Compromissos de hoje ainda de pé (pendente, confirmado ou atendido). */
  atendimentosHoje?: number;
  /** Compromissos de hoje marcados como falta. */
  faltasHoje?: number;
  /** Tarefas em aberto com prazo até o fim de hoje (inclui atrasadas). */
  tarefasAteHoje?: number;
  /** Conversas atribuídas a você com mensagem não lida. */
  conversasNaoLidas?: number;
}

export interface PortasDoResumo {
  agenda: boolean;
  tarefas: boolean;
  conversas: boolean;
}

/** `AAAA-MM-DD` de hoje no fuso da clínica. Fuso inválido cai no padrão. */
export function hojeNoFuso(agora: Date, fuso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(agora);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_PADRAO }).format(agora);
  }
}

/** O intervalo [início, fim) de hoje no fuso da clínica, em ISO. */
export function intervaloDeHoje(agora: Date, fuso: string): { de: string; ate: string } | null {
  const hoje = hojeNoFuso(agora, fuso);
  const de = primeiroInstanteDoDia(hoje, fuso) ?? primeiroInstanteDoDia(hoje, FUSO_PADRAO);
  const ate = primeiroInstanteDoDia(somarDias(hoje, 1), fuso) ?? primeiroInstanteDoDia(somarDias(hoje, 1), FUSO_PADRAO);
  if (!de || !ate) return null;
  return { de: de.toISOString(), ate: ate.toISOString() };
}

type Contagem = PromiseLike<{ count: number | null; error: unknown }>;

async function contar(consulta: () => Contagem): Promise<number | undefined> {
  try {
    const { count, error } = await consulta();
    return error || count === null ? undefined : count;
  } catch {
    return undefined;
  }
}

export async function resumoDoDia(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  fuso: string | null | undefined,
  portas: PortasDoResumo,
  agora: Date = new Date(),
): Promise<ResumoDoDia> {
  const hoje = intervaloDeHoje(agora, fuso || FUSO_PADRAO);
  const nada = Promise.resolve(undefined);

  const [atendimentosHoje, faltasHoje, tarefasAteHoje, conversasNaoLidas] = await Promise.all([
    portas.agenda && hoje
      ? contar(() =>
          supabase
            .from("calendar_appointments")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .in("status", ["pending", "confirmed", "completed"])
            .gte("starts_at", hoje.de)
            .lt("starts_at", hoje.ate),
        )
      : nada,
    portas.agenda && hoje
      ? contar(() =>
          supabase
            .from("calendar_appointments")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("status", "no_show")
            .gte("starts_at", hoje.de)
            .lt("starts_at", hoje.ate),
        )
      : nada,
    portas.tarefas && hoje
      ? contar(() =>
          supabase
            .from("crm_tasks")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .in("status", ["pending", "in_progress"])
            .lt("due_date", hoje.ate),
        )
      : nada,
    portas.conversas
      ? contar(() =>
          supabase
            .from("conversations")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("assigned_to_user_id", userId)
            .gt("unread_count_for_assignee", 0),
        )
      : nada,
  ]);

  return { atendimentosHoje, faltasHoje, tarefasAteHoje, conversasNaoLidas };
}
