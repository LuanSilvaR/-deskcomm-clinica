/**
 * Orçamentos (FORK clinic, orçamento O5) — a lista da clínica e os indicadores
 * do mês (enviados, conversão, valor aprovado, ticket médio). `orcamentos.ver`;
 * não é conteúdo clínico. Porta: lib/navigation/catalogo.ts e o módulo
 * Contratos do menu da clínica.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { exigePermissaoNaPagina } from "@/lib/clinic/acesso/pagina";
import { traduzir } from "@/lib/i18n/dicionario";

import { PainelDeOrcamentos } from "./_client";

export const dynamic = "force-dynamic";

export default async function OrcamentosPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const negado = await exigePermissaoNaPagina("orcamentos.ver");
  if (negado) return negado;

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Orçamentos")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Os orçamentos da clínica e quanto deles virou contrato no mês.")}
        </p>
      </header>
      <PainelDeOrcamentos />
    </div>
  );
}
