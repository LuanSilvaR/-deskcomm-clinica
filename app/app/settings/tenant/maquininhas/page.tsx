/**
 * Maquininhas (FORK clinic, financeiro FN1, migration 9039): adquirentes,
 * tabelas de taxa por vigência, tipo de cada forma de pagamento e o simulador
 * de recebimento líquido.
 *
 * Porta: lib/navigation/catalogo.ts. Ver com `financeiro.ver`; configurar com
 * `financeiro.taxas` (e a opção `clinic.financeiro_avancado` ligada).
 */
import { redirect } from "next/navigation";

import { Maquininhas } from "@/components/clinic/financeiro/Maquininhas";
import { RegrasDoFinanceiro } from "@/components/clinic/financeiro/RegrasDoFinanceiro";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { exigePermissaoNaPagina, permissoesNaPagina } from "@/lib/clinic/acesso/pagina";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";

export default async function MaquininhasPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const negado = await exigePermissaoNaPagina("financeiro.ver");
  if (negado) return negado;
  const permissoes = await permissoesNaPagina(user, activeOrg.orgId);

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Maquininhas e taxas")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Quanto cada maquininha cobra por forma e parcela, quando o dinheiro cai e quanto custa antecipar. É daqui que sai o valor líquido de cada venda.")}
        </p>
      </header>
      <Maquininhas podeConfigurar={permissoes.has("financeiro.taxas")} />
      <RegrasDoFinanceiro podeConfigurar={permissoes.has("financeiro.configurar")} />
    </div>
  );
}
