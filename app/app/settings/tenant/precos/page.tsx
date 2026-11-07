/**
 * Tabela de preços (FORK clinic, orçamento O1, migration 8006).
 *
 * Porta: lib/navigation/catalogo.ts. Ver com `orcamentos.ver`; publicar com
 * `orcamentos.precos`. Preço não é conteúdo clínico. A opção
 * `settings.clinic.orcamentos` nasce desligada (liga em Configurações ›
 * Profissionais); desligada, a tela avisa e não publica.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { permissoesNaPagina } from "@/lib/clinic/acesso/pagina";
import { traduzir } from "@/lib/i18n/dicionario";

import { TabelaDePrecosClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function TabelaDePrecosPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const permissoes = await permissoesNaPagina(user, activeOrg.orgId);
  if (!permissoes.has("orcamentos.ver")) redirect("/app");

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Tabela de preços")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("O preço de cada procedimento e pacote que entra nos orçamentos. Mudar um preço não altera orçamentos já enviados.")}
        </p>
      </header>
      <TabelaDePrecosClient podeEditar={permissoes.has("orcamentos.precos")} />
    </div>
  );
}
