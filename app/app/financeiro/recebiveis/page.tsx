/**
 * Contas a receber (FORK clinic, financeiro FN2, migration 9040): as parcelas
 * de cartão e Pix por vencimento, o líquido previsto em 30/60/90 dias, a baixa
 * manual e a antecipação. Ver com `financeiro.ver`; baixar e antecipar com
 * `financeiro.lancar`. Porta: lib/navigation/catalogo.ts.
 */
import { redirect } from "next/navigation";

import { ContasAReceber } from "@/components/clinic/financeiro/ContasAReceber";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { exigePermissaoNaPagina, permissoesNaPagina } from "@/lib/clinic/acesso/pagina";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";

export default async function RecebiveisPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const negado = await exigePermissaoNaPagina("financeiro.ver");
  if (negado) return negado;
  const permissoes = await permissoesNaPagina(user, activeOrg.orgId);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Contas a receber")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("As parcelas de cartão e Pix de cada comanda: quando caem, quanto entra depois da taxa e quanto custa antecipar. No vencimento, a baixa é automática.")}
        </p>
      </header>
      <ContasAReceber podeLancar={permissoes.has("financeiro.lancar")} />
    </div>
  );
}
