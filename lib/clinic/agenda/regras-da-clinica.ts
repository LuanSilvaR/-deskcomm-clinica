/**
 * O que o módulo clinic acrescenta à consulta de horários livres — o único
 * ponto que `lib/agenda/consulta.ts` (core) chama.
 *
 * Com a flag DESLIGADA devolve `{ ligado: false }` e a consulta segue idêntica
 * à do upstream. Ligada, responde duas perguntas:
 *   - o dono está habilitado para este tipo? (especialidades)
 *   - que bloqueios da clínica valem para ele na janela? (como ExcecaoDeData)
 *
 * Roda também com service role (ferramentas MCP): toda consulta filtra
 * `organization_id` explicitamente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExcecaoDeData } from "@/lib/agenda/horarios-livres";

import { clinicProfissionaisDaOrg } from "../flags";
import { profissionalHabilitado } from "../profissionais/habilitacao";

import { bloqueiosComoExcecoes, type BloqueioDaClinica } from "./expandir-bloqueios";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HabilitacaoNaConsulta =
  | { ligado: false }
  | { ligado: true; habilitado: true }
  | { ligado: true; habilitado: false }
  | { ligado: true; erro: string };

/** O módulo está ligado e, se estiver, o dono pode atender este tipo? */
export async function habilitacaoNaConsulta(
  supabase: SupabaseClient,
  organizationId: string,
  eventTypeId: string,
  donoId: string,
): Promise<HabilitacaoNaConsulta> {
  if (!(await clinicProfissionaisDaOrg(supabase, organizationId))) return { ligado: false };
  const r = await profissionalHabilitado(supabase, organizationId, eventTypeId, donoId);
  if (!r.ok) return { ligado: true, erro: r.erro };
  return r.habilitado ? { ligado: true, habilitado: true } : { ligado: true, habilitado: false };
}

/** Os bloqueios da clínica que valem para `donoId` entre os dois dias, já como exceções. */
export async function bloqueiosDaClinicaComoExcecoes(
  supabase: SupabaseClient,
  organizationId: string,
  donoId: string,
  primeiroDia: string,
  ultimoDia: string,
): Promise<{ ok: true; excecoes: ExcecaoDeData[] } | { ok: false; erro: string }> {
  // `donoId` entra numa string de filtro do PostgREST: só UUID passa.
  if (!UUID.test(donoId)) return { ok: false, erro: "dono inválido" };
  const { data, error } = await supabase
    .from("clinic_agenda_blocks")
    .select("user_id, starts_on, ends_on, start_minute, end_minute, weekdays")
    .eq("organization_id", organizationId)
    .or(`user_id.is.null,user_id.eq.${donoId}`)
    .lte("starts_on", ultimoDia)
    .gte("ends_on", primeiroDia);
  if (error) return { ok: false, erro: error.message };
  return {
    ok: true,
    excecoes: bloqueiosComoExcecoes((data ?? []) as BloqueioDaClinica[], donoId, primeiroDia, ultimoDia),
  };
}
