/**
 * FORK clinic (8012) — o favicon da organização ATIVA, para o `<head>` de /app.
 *
 * Chamado pelo `generateMetadata` de `app/app/layout.tsx`. `loadAuthUser` e
 * `resolveActiveOrg` são `cache()` por requisição, então o layout e o metadata
 * dividem a mesma resolução. A leitura usa o client de SESSÃO (a RLS de
 * `organizations` entrega a linha a quem é membro).
 *
 * Sem rede: devolve só a URL pública do arquivo no Storage do próprio projeto;
 * quem busca o ícone é o navegador. `null` = sem favicon próprio, e o `<head>`
 * fica com o `/icon` da raiz (`app/icon.tsx`).
 */
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { baseDoStorage, urlPublicaDoLogo } from "@/lib/branding/logo";
import { createClient } from "@/lib/supabase/server";

import { faviconDeSettings } from "./favicon";

export async function faviconDaOrganizacaoAtiva(): Promise<string | null> {
  try {
    const user = await loadAuthUser();
    if (!user) return null;
    const org = await resolveActiveOrg(user);
    if (!org) return null;
    const supabase = await createClient();
    const { data } = await supabase.from("organizations").select("settings").eq("id", org.orgId).maybeSingle();
    const caminho = faviconDeSettings(data?.settings ?? null);
    const base = baseDoStorage();
    return caminho && base ? urlPublicaDoLogo(caminho, base) : null;
  } catch {
    // O ícone da aba nunca derruba a página: na dúvida, fica o padrão.
    return null;
  }
}
