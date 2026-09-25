/**
 * Flag do módulo clinic: `organizations.settings.clinic.profissionais`.
 *
 * Nasce DESLIGADA. Só o booleano `true` liga — mesma régua de
 * `clientePelaAgendaLigado` (lib/schemas/settings.ts): ausente, `false`, a
 * string "true" ou lixo é desligado. Quem liga é `fn_clinic_definir_flag`
 * (migration 9001), nunca UPDATE direto em organizations.
 *
 * Mora fora de `settings.agenda` de propósito: `fn_agenda_settings` reescreve
 * aquele objeto inteiro e recusa chave desconhecida.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export function clinicProfissionaisLigado(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object" || Array.isArray(clinic)) return false;
  return (clinic as Record<string, unknown>).profissionais === true;
}

/**
 * Lê a flag da organização. Nunca lança: erro de leitura = desligado, que é o
 * lado que preserva o comportamento original da agenda.
 */
export async function clinicProfissionaisDaOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return false;
    return clinicProfissionaisLigado((data as { settings?: unknown }).settings);
  } catch {
    return false;
  }
}

/**
 * `organizations.settings.clinic.trava_sobreposicao` (migration 9005): o banco
 * recusa compromisso que cruza outro na agenda do mesmo profissional. Mesma
 * régua: só o booleano `true` liga.
 */
export function travaSobreposicaoLigada(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object" || Array.isArray(clinic)) return false;
  return (clinic as Record<string, unknown>).trava_sobreposicao === true;
}

/**
 * `organizations.settings.clinic.menu_clinica` (migration 9014): a casca desenha
 * o menu por módulos da clínica. É apresentação — não concede nem tira acesso.
 * Mesma régua: só o booleano `true` liga.
 */
export function menuClinicaLigado(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object" || Array.isArray(clinic)) return false;
  return (clinic as Record<string, unknown>).menu_clinica === true;
}

/**
 * `organizations.settings.clinic.procedimentos` (migration 9015): o módulo de
 * procedimentos e POP. Mesma régua: só o booleano `true` liga.
 */
export function procedimentosLigados(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object" || Array.isArray(clinic)) return false;
  return (clinic as Record<string, unknown>).procedimentos === true;
}

/**
 * `organizations.settings.clinic.prontuario` (migration 9016): o módulo de
 * atendimento clínico e prontuário. Nasce desligado; só o booleano `true` liga.
 */
export function prontuarioLigado(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object" || Array.isArray(clinic)) return false;
  return (clinic as Record<string, unknown>).prontuario === true;
}
