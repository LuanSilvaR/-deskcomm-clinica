/**
 * FORK clinic (ACL-011) — `organizations.settings.clinic.acesso_por_permissoes`.
 * Nasce desligada; só o booleano `true` liga (mesma régua das outras opções clinic).
 * Quem liga é `fn_clinic_definir_acesso_por_permissoes` (migration 9012).
 */
export function acessoPorPermissoesLigado(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const clinic = (settings as Record<string, unknown>).clinic;
  if (!clinic || typeof clinic !== "object" || Array.isArray(clinic)) return false;
  return (clinic as Record<string, unknown>).acesso_por_permissoes === true;
}
