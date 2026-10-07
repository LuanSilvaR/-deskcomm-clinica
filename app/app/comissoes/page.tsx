/**
 * Comissões — FORK clinic (organização do menu, 2026-10).
 *
 * As regras de comissão (migration 0240) moravam no meio do catálogo
 * financeiro, e o relatório "Comissão por pessoa" no Faturamento. Aqui ficam
 * juntos: as mesmas regras (mesmo componente e mesma API) e o caminho para o
 * que cada profissional tem a receber no período. Leitura para quem vê o
 * financeiro; escrita para manager+ (a RLS decide), como na tela de origem.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { ArrowRight } from "@/lib/ui/icons";

import { ComissoesDaClinica } from "./_client";

export const dynamic = "force-dynamic";

export default async function ComissoesPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const t = (texto: string) => traduzir(texto, user.idioma);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Comissões")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Regras de comissão por profissional e serviço, e quanto cada um tem a receber.")}
        </p>
      </header>
      <Link
        href="/app/faturamento"
        className="flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        data-testid="comissoes-relatorio"
      >
        <span>
          <span className="font-medium">{t("Quanto cada profissional tem a receber")}</span>
          <span className="block text-xs text-text-muted">{t("Relatório “Comissão por pessoa”, no Faturamento, por período.")}</span>
        </span>
        <ArrowRight size={16} aria-hidden />
      </Link>
      <ComissoesDaClinica podeEditar={ROLE_RANK[org.role] >= ROLE_RANK.manager} />
    </div>
  );
}
