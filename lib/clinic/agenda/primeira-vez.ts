/**
 * FORK clinic (agenda S4) — dois sinais da linha da agenda, calculados em lote
 * no molde de `contarFaltas` (`./faltas.ts`): nunca lançam, porque são
 * informação A MAIS — falhar aqui não pode derrubar a agenda.
 *
 *   1ª vez     o paciente não tem nenhum atendimento REALIZADO (`completed`)
 *              antes deste compromisso. Vale para a recepção (completar o
 *              cadastro) e para o profissional (anamnese).
 *   remarcado  a última mudança do compromisso foi de horário, e ninguém
 *              confirmou depois (`clinic_agenda_historico`, migration 9043).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CompromissoDoPaciente {
  id: string;
  contact_id: string | null;
  inicio: string;
}

/** Regra pura: é a 1ª vez se o primeiro realizado do paciente não vem antes deste. */
export function ehPrimeiraVez(inicio: string, primeiroRealizado: string | undefined): boolean {
  return !primeiroRealizado || new Date(primeiroRealizado).getTime() >= new Date(inicio).getTime();
}

/** Regra pura: a última marca (por ordem de criação) entre remarcar e confirmar é "remarcado". */
export function ultimoFoiRemarcar(eventos: readonly { tipo: string; created_at: string }[]): boolean {
  let ultimo: { tipo: string; created_at: string } | null = null;
  for (const e of eventos) {
    if (e.tipo !== "remarcado" && e.tipo !== "confirmado") continue;
    if (!ultimo || e.created_at >= ultimo.created_at) ultimo = e;
  }
  return ultimo?.tipo === "remarcado";
}

/** Os ids dos compromissos que são a 1ª vez do paciente. */
export async function compromissosDePrimeiraVez(
  supabase: SupabaseClient,
  organizationId: string,
  compromissos: readonly CompromissoDoPaciente[],
): Promise<Set<string>> {
  const resultado = new Set<string>();
  const pacientes = [...new Set(compromissos.map((c) => c.contact_id).filter((x): x is string => !!x))];
  if (pacientes.length === 0) return resultado;
  try {
    const { data, error } = await supabase
      .from("calendar_appointments")
      .select("contact_id, starts_at")
      .eq("organization_id", organizationId)
      .eq("status", "completed")
      .in("contact_id", pacientes)
      .order("starts_at", { ascending: true })
      .limit(10_000);
    if (error) return resultado;
    const primeiro = new Map<string, string>();
    for (const l of (data ?? []) as { contact_id: string | null; starts_at: string }[]) {
      if (l.contact_id && !primeiro.has(l.contact_id)) primeiro.set(l.contact_id, l.starts_at);
    }
    for (const c of compromissos) {
      if (c.contact_id && ehPrimeiraVez(c.inicio, primeiro.get(c.contact_id))) resultado.add(c.id);
    }
  } catch {
    return new Set();
  }
  return resultado;
}

/** Os ids dos compromissos remarcados e ainda não confirmados de novo. */
export async function compromissosRemarcados(
  supabase: SupabaseClient,
  organizationId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  const resultado = new Set<string>();
  if (ids.length === 0) return resultado;
  try {
    const { data, error } = await supabase
      .from("clinic_agenda_historico")
      .select("appointment_id, tipo, created_at")
      .eq("organization_id", organizationId)
      .in("appointment_id", [...new Set(ids)])
      .in("tipo", ["remarcado", "confirmado"])
      .limit(10_000);
    if (error) return resultado;
    const por = new Map<string, { tipo: string; created_at: string }[]>();
    for (const l of (data ?? []) as { appointment_id: string; tipo: string; created_at: string }[]) {
      por.set(l.appointment_id, [...(por.get(l.appointment_id) ?? []), l]);
    }
    for (const [id, eventos] of por) if (ultimoFoiRemarcar(eventos)) resultado.add(id);
  } catch {
    return new Set();
  }
  return resultado;
}
