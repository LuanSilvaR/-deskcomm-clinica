/**
 * "Falha que a Meta avisou depois" (#83, Ruling 15): mensagem do canal oficial COM
 * `external_id` (o wamid: a Meta aceitou), `failed`, reserva ainda nula e com
 * menos de 2 dias. A varredura da reserva e a carência da 9006 usam ESTE
 * predicado, para a 9006 nunca esperar por uma mensagem que a varredura não vai
 * pegar (recusa síncrona, mensagem velha).
 */
import { ehPreferidoDoLembrete } from "@/lib/channels/lembrete";

export const JANELA_DA_RESERVA_MS = 2 * 24 * 60 * 60_000;

export function desdeDaReserva(agora: Date): string {
  return new Date(agora.getTime() - JANELA_DA_RESERVA_MS).toISOString();
}

/** Filtros do PostgREST da varredura (a mesma regra de `aguardaAReservaDaMeta`). */
interface Filtravel<Q> {
  eq(c: string, v: unknown): Q;
  not(c: string, op: string, v: unknown): Q;
  is(c: string, v: null): Q;
  gt(c: string, v: unknown): Q;
}

export function soFalhasAvisadasDepois<Q>(q: Q, agora: Date): Q {
  // Cadeia tipada como Q -> Q para o tipo do PostgREST não recursar sem fim.
  const f = (x: unknown) => x as Filtravel<unknown>;
  let r: unknown = f(q).eq("status", "failed");
  r = f(r).not("external_id", "is", null);
  r = f(r).not("metadata->lembrete", "is", null);
  r = f(r).is("metadata->lembrete->>reserva", null);
  r = f(r).gt("created_at", desdeDaReserva(agora));
  return r as Q;
}

/** A mesma regra, em memória (carência da 9006). */
export function aguardaAReservaDaMeta(
  m: {
    status: string;
    external_id: string | null;
    created_at: string;
    metadata: { lembrete?: { reserva?: string | null } } | null;
    provider: string | undefined;
  } | null,
  agora: Date,
): boolean {
  if (!m || m.status !== "failed" || !ehPreferidoDoLembrete(m.provider) || !m.external_id) return false;
  const lembrete = m.metadata?.lembrete;
  if (!lembrete || (lembrete.reserva ?? null) !== null) return false;
  return new Date(m.created_at).getTime() > agora.getTime() - JANELA_DA_RESERVA_MS;
}
