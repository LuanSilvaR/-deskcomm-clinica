/**
 * Faltas (fork clinic, épico E5.1) — os pacientes que faltaram 2 vezes ou mais
 * nos últimos 12 meses. Porta: link na Recepção e lib/navigation/catalogo.ts.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

import { ListaDeFaltas } from "./_client";

export const dynamic = "force-dynamic";

export default async function FaltasPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Faltas")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Pacientes que faltaram 2 vezes ou mais nos últimos 12 meses. Vale confirmar por telefone o próximo horário deles.")}
        </p>
      </header>
      <ListaDeFaltas />
    </div>
  );
}
