/**
 * Pacote inicial de clínica (#154, migration 8025).
 *
 * A organização criada pelo `/admin` já nasce com os módulos de clínica
 * ligados, para a dona e o administrador da plataforma verem o menu de clínica
 * desde o primeiro acesso. Quem aplica é `fn_clinic_aplicar_pacote_inicial`,
 * executável só pelo service role; chave já presente em `settings.clinic`
 * vence o pacote. Nenhuma organização existente muda.
 *
 * Nunca lança: se falhar, a organização continua criada e os módulos podem
 * ser ligados à mão em Configurações. O retorno diz se aplicou.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const PACOTE_INICIAL_CLINICA = [
  "menu_clinica",
  "profissionais",
  "procedimentos",
  "prontuario",
  "estoque",
  "orcamentos",
  "recursos",
  "encaixe",
  "trava_sobreposicao",
] as const;

/** `organizationId` precisa vir de fonte confiável (o retorno da criação), nunca do body. */
export async function aplicarPacoteInicialClinica(
  admin: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  try {
    const { error } = await admin.rpc("fn_clinic_aplicar_pacote_inicial", { p_org: organizationId });
    return !error;
  } catch {
    return false;
  }
}
