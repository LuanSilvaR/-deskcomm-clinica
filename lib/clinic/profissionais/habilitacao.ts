/**
 * Quem está HABILITADO para um tipo de atendimento.
 *
 * Regra (migration 9001):
 *   - tipo SEM especialidade exigida → qualquer profissional;
 *   - tipo COM especialidades → basta o profissional ter UMA delas, e a ficha
 *     dele estar ativa.
 *
 * Todas as consultas filtram `organization_id` explicitamente: estas funções
 * também rodam com service role (ferramentas MCP da IA), que ignora a RLS.
 * Quem chama decide se a flag está ligada — com ela desligada, não chame.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Núcleo puro da regra. */
export function atendeAsExigencias(
  exigidas: readonly string[],
  doProfissional: readonly string[],
): boolean {
  if (exigidas.length === 0) return true;
  const tem = new Set(doProfissional);
  return exigidas.some((id) => tem.has(id));
}

export type ResultadoDaHabilitacao =
  | { ok: true; habilitado: boolean; exigidas: string[] }
  | { ok: false; erro: string };

async function especialidadesExigidas(
  supabase: SupabaseClient,
  organizationId: string,
  eventTypeId: string,
): Promise<{ ok: true; ids: string[] } | { ok: false; erro: string }> {
  const { data, error } = await supabase
    .from("clinic_event_type_specialties")
    .select("specialty_id, clinic_specialties!inner(is_active)")
    .eq("organization_id", organizationId)
    .eq("event_type_id", eventTypeId)
    .eq("clinic_specialties.is_active", true);
  if (error) return { ok: false, erro: error.message };
  return { ok: true, ids: (data ?? []).map((l) => String((l as { specialty_id: string }).specialty_id)) };
}

/** O profissional `userId` pode ser marcado para `eventTypeId`? */
export async function profissionalHabilitado(
  supabase: SupabaseClient,
  organizationId: string,
  eventTypeId: string,
  userId: string,
): Promise<ResultadoDaHabilitacao> {
  const exigidas = await especialidadesExigidas(supabase, organizationId, eventTypeId);
  if (!exigidas.ok) return exigidas;
  if (exigidas.ids.length === 0) return { ok: true, habilitado: true, exigidas: [] };

  const { data, error } = await supabase
    .from("clinic_professional_specialties")
    .select("specialty_id, clinic_professionals!inner(user_id, is_active)")
    .eq("organization_id", organizationId)
    .eq("clinic_professionals.user_id", userId)
    .eq("clinic_professionals.is_active", true)
    .in("specialty_id", exigidas.ids);
  if (error) return { ok: false, erro: error.message };
  const doProfissional = (data ?? []).map((l) => String((l as { specialty_id: string }).specialty_id));
  return {
    ok: true,
    habilitado: atendeAsExigencias(exigidas.ids, doProfissional),
    exigidas: exigidas.ids,
  };
}

/**
 * Os `user_id` habilitados para `eventTypeId`, ou `null` quando o tipo não exige
 * especialidade (= todos os membros servem; quem chama usa a lista que já tinha).
 */
export async function profissionaisHabilitados(
  supabase: SupabaseClient,
  organizationId: string,
  eventTypeId: string,
): Promise<{ ok: true; userIds: string[] | null } | { ok: false; erro: string }> {
  const exigidas = await especialidadesExigidas(supabase, organizationId, eventTypeId);
  if (!exigidas.ok) return exigidas;
  if (exigidas.ids.length === 0) return { ok: true, userIds: null };

  const { data, error } = await supabase
    .from("clinic_professional_specialties")
    .select("clinic_professionals!inner(user_id, is_active)")
    .eq("organization_id", organizationId)
    .eq("clinic_professionals.is_active", true)
    .in("specialty_id", exigidas.ids);
  if (error) return { ok: false, erro: error.message };
  const ids = new Set<string>();
  for (const l of data ?? []) {
    const p = (l as { clinic_professionals: { user_id: string } | { user_id: string }[] }).clinic_professionals;
    for (const x of Array.isArray(p) ? p : [p]) ids.add(x.user_id);
  }
  return { ok: true, userIds: [...ids] };
}
