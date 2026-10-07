/**
 * Caixa do dia (FORK clinic, financeiro FN3, migration 9041): entradas,
 * saídas e saldo do dia por categoria, comparados com ontem e a média de 7
 * dias; abertura e fechamento da gaveta com fundo de troco, suprimento,
 * sangria, caixa pequeno e dupla conferência. Ver com `financeiro.ver`; mexer na
 * gaveta com `financeiro.caixa`; conferir com `financeiro.conferir`.
 */
import { redirect } from "next/navigation";

import { CaixaDoDia } from "@/components/clinic/financeiro/CaixaDoDia";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { exigePermissaoNaPagina, permissoesNaPagina } from "@/lib/clinic/acesso/pagina";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";

export default async function CaixaPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">{t("Caixa do dia")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("O que entrou e saiu hoje, por categoria, e a gaveta: abertura com fundo de troco, sangria, caixa pequeno e o fechamento conferido.")}
        </p>
      </header>
      <CaixaDoDia
        podeCaixa={permissoes.has("financeiro.caixa")}
        podeConferir={permissoes.has("financeiro.conferir")}
        usuarioId={user.id}
      />
    </div>
  );
}
