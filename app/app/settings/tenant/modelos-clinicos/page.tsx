/**
 * Modelos clínicos e requisitos de finalização (FORK clinic, prontuário F3).
 *
 * Porta: lib/navigation/catalogo.ts. Só com `modelos_clinicos.gerenciar` —
 * configuração, sem acesso a paciente nenhum.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { permissoesNaPagina } from "@/lib/clinic/acesso/pagina";
import { traduzir } from "@/lib/i18n/dicionario";

import { ModelosClinicosClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function ModelosClinicosPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const permissoes = await permissoesNaPagina(user, activeOrg.orgId);
  if (!permissoes.has("modelos_clinicos.gerenciar")) redirect("/app");

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Modelos clínicos")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Os formulários de anamnese e avaliação que os profissionais preenchem, e o que é obrigatório para finalizar um atendimento.")}
        </p>
      </header>
      <ModelosClinicosClient />
    </div>
  );
}
