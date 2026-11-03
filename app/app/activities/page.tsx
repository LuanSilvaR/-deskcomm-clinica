import { exigePermissaoNaPagina } from "@/lib/clinic/acesso/pagina";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

import { ActivityReportClient } from "./_components/ActivityReportClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Atividades" };

export default async function ActivitiesReportPage() {
  // FORK clinic (agenda S5): tela administrativa — sem a chave, "acesso não autorizado" (o menu já a esconde).
  const negado = await exigePermissaoNaPagina("tarefas.ver");
  if (negado) return negado;
  const user = await requireAuth();
  // `t` local e não o hook: componente de SERVIDOR — o idioma já vem resolvido
  // pela cadeia pessoa → organização → padrão em `lib/auth/server.ts`.
  const t = (texto: string) => traduzir(texto, user.idioma);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Atividades")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("O que aconteceu na operação no período — e quanto disso foi a equipe.")}
        </p>
      </header>

      <ActivityReportClient />
    </div>
  );
}
