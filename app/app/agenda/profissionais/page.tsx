/**
 * O dia por profissional (fork clinic, épico E1.4) — uma coluna por quem atende
 * no dia, com jornada, bloqueios e compromissos. Porta: botão "Dia por
 * profissional" no cabeçalho da Agenda e lib/navigation/catalogo.ts.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

import { DiaPorProfissional } from "./_client";

export const dynamic = "force-dynamic";

export default async function DiaPorProfissionalPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia } = await searchParams;
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Dia por profissional")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Quem atende no dia, lado a lado: jornada, bloqueios e compromissos de cada profissional.")}
        </p>
      </header>
      <DiaPorProfissional orgId={activeOrg.orgId} dia={dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null} />
    </div>
  );
}
