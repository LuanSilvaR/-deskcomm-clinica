/**
 * FORK clinic (agenda S5) — a CHAVE da clínica numa rota do núcleo, que só
 * exige papel (`requireRole`). O papel "Profissional de saúde" tem nível
 * `agent` (é o nível das chaves clínicas dele), e sem isto passaria nas rotas
 * de financeiro do núcleo que o menu e a página já escondem dele.
 *
 * Mesma fonte das outras checagens: `fn_member_permissions` (modo legado =
 * chaves pelo nível, então nada muda para quem não usa papéis).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail } from "@/lib/api/wrappers";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";

import { permissoesEfetivas } from "./resolver";

export async function exigeChaveNoNucleo(
  supabase: SupabaseClient,
  organizationId: string,
  chave: string,
  requestId: string,
  idioma: Idioma = "pt-BR",
): Promise<Response | null> {
  const efetivas = await permissoesEfetivas(supabase, organizationId);
  if (efetivas.ok && efetivas.permissoes.has(chave)) return null;
  return fail("forbidden_permission", traduzir("Você não tem permissão para esta ação.", idioma), 403, {
    requestId,
    details: { permissao: chave },
  });
}
