import Link from "next/link";

import { AcoesDaAssinatura } from "@/components/cobranca/AcoesDaAssinatura";
import { PainelDaAssinatura } from "@/components/cobranca/PainelDaAssinatura";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { emailDeSuporte } from "@/lib/branding/saida";
import { lerPainelDoHub, oQueOHubMostra } from "@/lib/cobranca/hub";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { tipoDaSuspensao } from "@/lib/organizacao/operante";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/dicionario";

export const metadata = {
  title: "Conta suspensa",
};
export const dynamic = "force-dynamic";

/**
 * Esta tela entregava o NOSSO endereço de suporte ao cliente de um revendedor —
 * e aqui isso é ativamente errado: quem suspendeu a conta foi o revendedor, e
 * escrever para nós não desbloqueia nada. O endereço agora sai de
 * `SUPPORT_EMAIL` (o do operador) e, quando ninguém configurou, o parágrafo do
 * contato simplesmente NÃO renderiza. Cair de volta num endereço do produto
 * seria o defeito de volta, com o agravante de parecer resolvido.
 */
export default async function AccountSuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ voltou?: string }>;
}) {
  const suporte = await emailDeSuporte();
  // Rota fora da árvore de `app/app/layout.tsx` — sem `IdiomaProvider`, então
  // resolve o idioma direto, como `admin/forbidden/page.tsx`. Quem chega aqui
  // normalmente tem sessão do Supabase Auth (a suspensão é regra do produto,
  // não um ban de autenticação), mas `user` fica opcional por segurança.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const idioma = normalizarIdioma(
    (user?.user_metadata?.locale as string | undefined) ?? null,
  );

  // FORK (card #160c; origem upstream, spec da cobrança §9): suspensa POR FALTA
  // DE PAGAMENTO + quem administra → o painel com Pagar agora / Já paguei, e a
  // empresa volta sozinha ao pagar. A org vem da SESSÃO (cookie validado contra
  // os vínculos), nunca da URL. Leitura que falha não derruba a tela: cai para o
  // contato de sempre.
  const authUser = user ? await loadAuthUser() : null;
  const ativa = authUser ? await resolveActiveOrg(authUser) : null;
  let painel: Awaited<ReturnType<typeof lerPainelDoHub>> = null;
  let mostraPagamento = false;
  if (authUser && ativa) {
    const admin = createAdminClient();
    const { data: org } = await admin.from("organizations").select("status, suspended_kind").eq("id", ativa.orgId).maybeSingle();
    const tipo = tipoDaSuspensao(org?.status ?? null, (org as { suspended_kind?: string | null } | null)?.suspended_kind ?? null);
    const administra = (authUser.is_platform_admin && !authUser.support) || ROLE_RANK[ativa.role] >= ROLE_RANK.admin;
    const cobrancaLigada = tipo === "cobranca" && (await moduloLigado(admin, "cobranca"));
    painel = cobrancaLigada && administra ? await lerPainelDoHub(admin, ativa.orgId) : null;
    mostraPagamento =
      oQueOHubMostra({ administra, tipo, cobrancaLigada, temAssinatura: painel?.assinatura != null }) === "pagamento";
  }
  const voltou = (await searchParams).voltou === "1";

  return (
    <IdiomaProvider locale={idioma}>
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-4 sm:p-8">
      <Card className="w-full max-w-md p-8 text-center space-y-4">
        <h1 className="text-2xl font-semibold">{traduzir("Conta suspensa", idioma)}</h1>
        {mostraPagamento ? (
          <p className="text-sm text-muted-foreground">
            {traduzir("A conta foi suspensa por falta de pagamento. O acesso é reavaliado após a confirmação do pagamento.", idioma)}
          </p>
        ) : suporte ? (
          <p className="text-sm text-muted-foreground">
            {traduzir("Sua conta está suspensa. Entre em contato com", idioma)}{" "}
            <a
              href={`mailto:${suporte}`}
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              {suporte}
            </a>{" "}
            {traduzir("para mais informações.", idioma)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {traduzir(
              "Sua conta está suspensa. Fale com quem administra este sistema para saber o motivo e como reativá-la.",
              idioma,
            )}
          </p>
        )}
        <div className="pt-2">
          <Button asChild variant="outline">
            <Link href="/login">{traduzir("Sair", idioma)}</Link>
          </Button>
        </div>
      </Card>
      {mostraPagamento && painel?.assinatura && (
        <section aria-label={traduzir("Pagamento", idioma)} className="w-full max-w-xl space-y-4" data-testid="hub-pagamento">
          <PainelDaAssinatura dados={painel} idioma={idioma} />
          <AcoesDaAssinatura
            estado={painel.assinatura.estado}
            temProvedor={painel.assinatura.provedor !== null}
            assinaturasVivas={painel.assinatura.assinaturas_vivas}
            linkDePagamento={painel.assinatura.link_de_pagamento}
            cancelaNoFim={painel.assinatura.cancela_no_fim}
            provedor={painel.checkout.provedor}
            documentoDoCadastro={painel.checkout.documentoDoCadastro}
            voltouDoCheckout={voltou}
            noHub
            fuso={painel.fuso}
          />
        </section>
      )}
    </main>
    </IdiomaProvider>
  );
}
