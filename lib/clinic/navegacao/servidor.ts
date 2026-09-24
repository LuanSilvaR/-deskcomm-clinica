/**
 * FORK clinic (9014) — leitura da flag do menu da clínica no servidor, para
 * telas que não recebem o `activeOrg` montado pelo layout (a casa `/app`).
 * Nunca lança: erro de leitura = desligado, o menu de sempre.
 */
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";
import { permissoesParaOMenu } from "@/lib/clinic/acesso/menu";
import { menuClinicaLigado } from "@/lib/clinic/flags";
import { modulosLigados } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { modulosVisiveis, type ModuloVisivel } from "./projecao";

/**
 * Os módulos que esta pessoa vê, calculados no servidor com as MESMAS entradas
 * que o layout de `/app` entrega ao menu lateral: interface da organização,
 * papel, módulos opcionais da instalação e permissões efetivas.
 */
export async function modulosDoServidor(user: AuthUser, activeOrg: ActiveOrg | null): Promise<ModuloVisivel[]> {
  let modulos: Awaited<ReturnType<typeof modulosLigados>> = [];
  try {
    modulos = await modulosLigados(createAdminClient());
  } catch {
    modulos = [];
  }
  return modulosVisiveis(
    user.is_platform_admin && !user.support,
    activeOrg?.role ?? null,
    activeOrg?.interface_settings,
    modulos,
    await permissoesParaOMenu(activeOrg?.orgId),
  );
}

export async function menuClinicaDaOrg(organizationId: string | null | undefined): Promise<boolean> {
  if (!organizationId) return false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return false;
    return menuClinicaLigado((data as { settings?: unknown }).settings);
  } catch {
    return false;
  }
}
