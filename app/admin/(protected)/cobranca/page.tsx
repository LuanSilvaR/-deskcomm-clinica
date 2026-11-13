import { notFound } from "next/navigation";

import { loadAuthUser } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { provedorDaInstalacao } from "@/lib/cobranca/configuracao";
import { modoDoProvedor } from "@/lib/cobranca/provedores";
import { baseDeTesteDaCobranca } from "@/lib/cobranca/provedores/base-de-teste";
import { urlDoWebhookDaCobranca } from "@/lib/cobranca/url";
import { env } from "@/lib/env";
import { estadoParaTela } from "@/lib/instalacao/config";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { COLUNAS_DO_PLANO, type PlanoDeCobranca } from "@/lib/schemas/cobranca-plano";
import { createAdminClient } from "@/lib/supabase/admin";

import { ConexaoDaCobranca } from "./_conexao";
import { PlanosDaPlataforma } from "./_planos";

export const metadata = { title: "Cobrança da plataforma" };
export const dynamic = "force-dynamic";

/**
 * FORK (card #159; origem upstream `/admin/cobranca`, aba Planos) — os planos
 * de cobrança da plataforma: o dono cria, edita, arquiva e escolhe o plano em
 * que a clínica nova nasce em teste grátis. Provedor, checkout e régua chegam
 * no card #160: a Conexão (160a) guarda a chave cifrada do provedor e o aviso
 * de pagamento; checkout e régua vêm no 160b/160c. Comece pelo modo de teste.
 *
 * `notFound()` para quem não administra a plataforma e com o módulo
 * `cobranca` desligado: desligada, a cobrança não faz parte do produto.
 */
export default async function Page() {
  const usuario = await loadAuthUser();
  if (!usuario?.is_platform_admin) notFound();
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "cobranca"))) notFound();

  // A Conexão: provedor, modo e os 4 últimos da chave — a chave nunca chega à tela.
  const provedor = await provedorDaInstalacao();
  const [modo, estadoDaChave] = provedor
    ? await Promise.all([
        modoDoProvedor(provedor),
        estadoParaTela(provedor === "stripe" ? "STRIPE_SECRET_KEY" : "ASAAS_API_KEY", true),
      ])
    : [null, null];
  const urlDoWebhook = urlDoWebhookDaCobranca(env.NEXT_PUBLIC_APP_URL ?? "", provedor ?? "asaas", baseDeTesteDaCobranca() !== null);

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
      <section className="space-y-3" aria-labelledby="titulo-conexao">
        <h2 id="titulo-conexao" className="text-lg font-semibold">
          {traduzir("Conexão com o provedor", usuario.idioma)}
        </h2>
        <ConexaoDaCobranca
          provedor={provedor}
          modo={modo}
          last4={estadoDaChave?.fonte === "banco" ? estadoDaChave.last4 : null}
          urlDoWebhook={urlDoWebhook}
        />
      </section>
      <section className="space-y-3" aria-labelledby="titulo-planos">
        <h2 id="titulo-planos" className="text-lg font-semibold">
          {traduzir("Planos", usuario.idioma)}
        </h2>
        <PlanosDaPlataforma planos={(data ?? []) as PlanoDeCobranca[]} />
      </section>
    </div>
  );
}
