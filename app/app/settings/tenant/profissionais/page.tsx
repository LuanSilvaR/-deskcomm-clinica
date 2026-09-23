/**
 * Profissionais e especialidades (módulo clinic do fork, migration 9001).
 *
 * Porta: lib/navigation/catalogo.ts. Atendente entra para bloquear a PRÓPRIA
 * agenda; cadastro de fichas, especialidades e exigências é da gerência; ligar
 * o módulo é do admin.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { clinicProfissionaisLigado } from "@/lib/clinic/flags";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

import { ProfissionaisClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function ProfissionaisPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (ROLE_RANK[activeOrg.role] < ROLE_RANK.agent && !user.is_platform_admin) redirect("/app");

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();

  const ehGerencia =
    (user.is_platform_admin && !user.support) || ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Profissionais e especialidades")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Quem atende, o que cada um sabe fazer, quando atende e quando a agenda fica fechada.")}
        </p>
      </header>
      <ProfissionaisClient
        ligadoInicial={clinicProfissionaisLigado(org?.settings)}
        podeLigar={ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin}
        ehGerencia={ehGerencia}
        usuarioAtualId={user.id}
      />
    </div>
  );
}
