/**
 * Indicadores da agenda (fork clinic, épico E6) — faltas, ocupação por
 * profissional, espera na recepção e resultado da confirmação. A partir de
 * gerente. Porta: lib/navigation/catalogo.ts (grupo Análise) e link na
 * tela de Faltas.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";

import { IndicadoresDaAgenda } from "./_client";

export const dynamic = "force-dynamic";

export default async function IndicadoresPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const pode = ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager || user.is_platform_admin;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Indicadores da agenda")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Comparecimento, faltas, ocupação de cada profissional, espera na recepção e resultado da confirmação, no período escolhido.")}
        </p>
      </header>
      {pode ? (
        <IndicadoresDaAgenda />
      ) : (
        <p className="text-sm text-text-muted">{t("Só gerentes e administradores veem os indicadores.")}</p>
      )}
    </div>
  );
}
