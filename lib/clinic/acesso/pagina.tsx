/**
 * FORK clinic (ACL-007) — guard de PÁGINA por permissão (server component).
 *
 * `const negado = await exigePermissaoNaPagina("papeis.ver"); if (negado) return negado;`
 * Quem digita a URL sem ter a permissão vê "Acesso não autorizado" — e a rota
 * e a RLS continuam negando os dados de qualquer jeito (isto é UX, não trava).
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

import type { ChaveDePermissao } from "./catalogo";
import { permissoesEfetivas } from "./resolver";

export async function exigePermissaoNaPagina(chave: ChaveDePermissao): Promise<React.ReactElement | null> {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  if (user.is_platform_admin && !user.support) return null;
  const efetivas = await permissoesEfetivas(await createClient(), org.orgId);
  if (efetivas.ok && efetivas.permissoes.has(chave)) return null;
  const t = (s: string) => traduzir(s, user.idioma);
  return (
    <div className="flex h-full flex-col items-start gap-2 p-6" data-testid="acesso-nao-autorizado">
      <h1 className="text-2xl font-semibold tracking-tight">{t("Acesso não autorizado")}</h1>
      <p className="text-sm text-text-muted">{t("Seu papel de acesso não inclui esta tela. Fale com quem administra a empresa.")}</p>
    </div>
  );
}
