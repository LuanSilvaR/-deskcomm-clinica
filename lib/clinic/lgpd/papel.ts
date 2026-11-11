/** Rótulo do papel em português, como aparece no atestado de anonimização. */
const ROTULOS: Record<string, string> = {
  owner: "proprietário",
  admin: "administrador",
};

export function papelEmPortugues(papel: string): string {
  return ROTULOS[papel] ?? papel;
}
