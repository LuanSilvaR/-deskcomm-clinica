/**
 * Procedimentos (fork clinic, migration 9015) — o catálogo de procedimentos da
 * clínica, ligado às especializações e profissionais já cadastrados, com o POP
 * de cada um. Nasce desligado (`clinic.procedimentos`): liga em Configurações ›
 * Profissionais. Porta: lib/navigation/catalogo.ts.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { exigePermissaoNaPagina } from "@/lib/clinic/acesso/pagina";
import { traduzir } from "@/lib/i18n/dicionario";

import { ModuloDesligado, moduloLigado } from "./_desligado";
import { ListaDeProcedimentos } from "./_client";

export const dynamic = "force-dynamic";

export default async function ProcedimentosPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const negado = await exigePermissaoNaPagina("procedimentos.ver");
  if (negado) return negado;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Procedimentos")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Os procedimentos que a clínica realiza, quem pode realizar cada um e o POP de cada procedimento.")}
        </p>
      </header>
      {(await moduloLigado(activeOrg.orgId)) ? <ListaDeProcedimentos /> : <ModuloDesligado idioma={user.idioma} />}
    </div>
  );
}
