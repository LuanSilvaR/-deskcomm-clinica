/**
 * Salas e equipamentos — FORK clinic (organização do menu, 2026-10).
 *
 * O cadastro de salas e aparelhos (migration 9007) ganha tela própria no módulo
 * "Salas e equipamentos"; antes vivia só numa aba de Profissionais (que
 * continua lá). Mesmo componente, mesmas APIs, mesma permissão: quem vê
 * profissionais vê; quem gerencia profissionais edita.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { SalasEEquipamentos } from "@/components/clinic/SalasEEquipamentos";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { permissoesNaPagina } from "@/lib/clinic/acesso/pagina";
import { recursosLigados } from "@/lib/clinic/agenda/recursos";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EquipamentosPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const permissoes = await permissoesNaPagina(user, activeOrg.orgId);
  if (!permissoes.has("profissionais.ver") && !permissoes.has("profissionais.gerenciar") && !user.is_platform_admin) {
    redirect("/app");
  }
  const { data: org } = await (await createClient())
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Salas e equipamentos")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("As salas e os aparelhos da clínica, e o que cada tipo de atendimento exige.")}
        </p>
      </header>
      {!recursosLigados(org?.settings) ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-text-muted" data-testid="equipamentos-desligado">
          {t("A reserva automática de salas e equipamentos na agenda está desligada.")}{" "}
          <Link href="/app/settings/tenant/profissionais" className="underline">
            {t("Ligar em Profissionais")}
          </Link>
        </p>
      ) : null}
      <SalasEEquipamentos podeEditar={permissoes.has("profissionais.gerenciar")} />
    </div>
  );
}
