/**
 * FORK clinic (agenda S5, migration 9044) — DE QUAIS pacientes a pessoa lê.
 *
 * Com `pacientes.ver_todos` (todo papel que já via pacientes a recebeu, e o
 * modo legado a dá pelo nível): a clínica inteira — `null` = sem recorte.
 * Sem ela (o papel "Profissional de saúde"): só os pacientes com agendamento
 * em que a pessoa é o profissional. As rotas e telas de paciente aplicam isto
 * ANTES de ler; a RLS de `contacts` segue a do núcleo (Inbox e IA leem ali).
 *
 * Falha ao ler as permissões FECHA: vale só o recorte próprio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { permissoesEfetivas } from "@/lib/clinic/acesso/resolver";

export const PERMISSAO_VER_TODOS_OS_PACIENTES = "pacientes.ver_todos";

/** Regra pura: com a chave, sem recorte; sem ela, os pacientes da própria agenda. */
export function recorteDePacientes(permissoes: ReadonlySet<string>, daPropriaAgenda: readonly string[]): string[] | null {
  return permissoes.has(PERMISSAO_VER_TODOS_OS_PACIENTES) ? null : [...new Set(daPropriaAgenda)];
}

async function pacientesDaPropriaAgenda(supabase: SupabaseClient, organizationId: string, usuarioId: string): Promise<string[]> {
  const { data } = await supabase
    .from("calendar_appointments")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .eq("owner_user_id", usuarioId)
    .not("contact_id", "is", null)
    .limit(20_000);
  return ((data ?? []) as { contact_id: string | null }[]).map((l) => l.contact_id).filter((x): x is string => !!x);
}

/** `null` = a clínica inteira; lista = só estes pacientes. */
export async function contatosDoEscopo(
  supabase: SupabaseClient,
  organizationId: string,
  usuarioId: string,
): Promise<string[] | null> {
  const efetivas = await permissoesEfetivas(supabase, organizationId);
  const permissoes = efetivas.ok ? efetivas.permissoes : new Set<string>();
  if (permissoes.has(PERMISSAO_VER_TODOS_OS_PACIENTES)) return null;
  return recorteDePacientes(permissoes, await pacientesDaPropriaAgenda(supabase, organizationId, usuarioId));
}

/** O paciente está no escopo de quem pede? */
export async function pacienteNoEscopo(
  supabase: SupabaseClient,
  organizationId: string,
  usuarioId: string,
  contactId: string,
): Promise<boolean> {
  const escopo = await contatosDoEscopo(supabase, organizationId, usuarioId);
  return escopo === null || escopo.includes(contactId);
}
