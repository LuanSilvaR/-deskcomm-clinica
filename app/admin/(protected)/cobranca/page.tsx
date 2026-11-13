import { notFound } from "next/navigation";

import { loadAuthUser } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { COLUNAS_DO_PLANO, type PlanoDeCobranca } from "@/lib/schemas/cobranca-plano";
import { createAdminClient } from "@/lib/supabase/admin";

import { PlanosDaPlataforma } from "./_planos";

export const metadata = { title: "Cobrança da plataforma" };
export const dynamic = "force-dynamic";

/**
 * FORK (card #159; origem upstream `/admin/cobranca`, aba Planos) — os planos
 * de cobrança da plataforma: o dono cria, edita, arquiva e escolhe o plano em
 * que a clínica nova nasce em teste grátis. Provedor, checkout e régua chegam
 * no card #160 — nada aqui cobra de verdade.
 *
 * `notFound()` para quem não administra a plataforma e com o módulo
 * `cobranca` desligado: desligada, a cobrança não faz parte do produto.
 */
export default async function Page() {
  const usuario = await loadAuthUser();
  if (!usuario?.is_platform_admin) notFound();
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "cobranca"))) notFound();

  const { data } = await admin
    .from("cobranca_planos")
    .select(COLUNAS_DO_PLANO)
    .order("arquivado_em", { ascending: true, nullsFirst: true })
    .order("preco_cents", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {traduzir("Cobrança da plataforma", usuario.idioma)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {traduzir(
            "Os planos que as clínicas assinam. Cada clínica nova nasce em teste grátis no plano do cadastro. Nenhuma cobrança real acontece nesta etapa.",
            usuario.idioma,
          )}
        </p>
      </div>
      <PlanosDaPlataforma planos={(data ?? []) as PlanoDeCobranca[]} />
    </div>
  );
}
