import { atestadoAnonimizacaoLigadoNaConfig } from "@/lib/clinic/flags";
import { fail } from "@/lib/api/wrappers";
import { createAdminClient } from "@/lib/supabase/admin";

/** Lê a chave do atestado em `organizations.settings` (admin client, filtrado pela org). */
export async function atestadoLigado(admin: ReturnType<typeof createAdminClient>, orgId: string): Promise<boolean> {
  const { data } = await admin.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  return atestadoAnonimizacaoLigadoNaConfig((data as { settings?: unknown } | null)?.settings);
}

export function recursoDesligado(requestId: string) {
  return fail("feature_disabled", "O atestado de anonimização não está ligado nesta clínica.", 403, { requestId });
}
