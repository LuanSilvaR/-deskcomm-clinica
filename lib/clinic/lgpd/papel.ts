import { ROTULO_DO_PAPEL } from "@/lib/auth/types";

/** Rótulo dado a quem entrou pela porta da plataforma, sem ser membro da clínica. */
export const ROTULO_SUPORTE_DA_PLATAFORMA = "suporte da plataforma";

/** Rótulo do papel em português, como aparece no atestado de anonimização. */
const ROTULOS: Record<string, string> = {
  owner: "proprietário",
  ...Object.fromEntries(Object.entries(ROTULO_DO_PAPEL).map(([papel, rotulo]) => [papel, rotulo.toLowerCase()])),
};

export function papelEmPortugues(papel: string): string {
  return ROTULOS[papel] ?? papel;
}
