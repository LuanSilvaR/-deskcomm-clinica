/**
 * FORK clinic (ACL-008) — as permissões que o MENU usa (sidebar, hubs, ⌘K).
 *
 * Só com o modo por permissões ligado: aí cada porta com `permissao` no
 * catálogo de navegação aparece apenas para quem a tem. Desligado devolve
 * `undefined` e o menu segue o `minRole` de sempre. UX apenas — a rota e a RLS
 * decidem de verdade. Nunca lança: falha de leitura = menu como antes.
 */
import { createClient } from "@/lib/supabase/server";

import { permissoesEfetivas } from "./resolver";

export async function permissoesParaOMenu(organizationId: string | null | undefined): Promise<readonly string[] | undefined> {
  if (!organizationId) return undefined;
  try {
    const supabase = await createClient();
    const { data: ligado } = await supabase.rpc("fn_acesso_modo_ligado", { p_org: organizationId });
    if (ligado !== true) return undefined;
    const efetivas = await permissoesEfetivas(supabase, organizationId);
    return efetivas.ok ? [...efetivas.permissoes] : undefined;
  } catch {
    return undefined;
  }
}
