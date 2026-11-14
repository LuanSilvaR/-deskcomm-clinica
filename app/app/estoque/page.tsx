/**
 * Estoque (fork clinic, estoque E0, migration 9028) — saldo por produto, lote,
 * validade e local; entradas, transferências, perdas, ajustes e estornos.
 * Saldo = soma dos movimentos. Nasce desligado (`clinic.estoque`): liga em
 * Configurações › Profissionais. Porta: lib/navigation/catalogo.ts.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { exigePermissaoNaPagina } from "@/lib/clinic/acesso/pagina";
import { traduzir } from "@/lib/i18n/dicionario";

import { PainelDoEstoque } from "./_client";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const negado = await exigePermissaoNaPagina("estoque.ver");
  if (negado) return negado;

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Estoque")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t(
            "O saldo de cada produto por lote, validade e local. Cada entrada e saída fica registrada; o saldo é sempre a soma delas.",
          )}
        </p>
      </header>
      <PainelDoEstoque />
    </div>
  );
}
