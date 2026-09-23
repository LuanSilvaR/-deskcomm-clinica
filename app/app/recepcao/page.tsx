/**
 * Painel da recepção (fork clinic, migration 9003) — o dia da clínica por
 * status da visita, em tempo real. Porta: lib/navigation/catalogo.ts.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";

import { PainelDaRecepcao } from "./_client";

export const dynamic = "force-dynamic";

export default async function RecepcaoPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Recepção")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Os pacientes agendados hoje, do momento em que chegam até o fim do atendimento. Atualiza sozinho.")}
        </p>
      </header>
      <PainelDaRecepcao
        orgId={activeOrg.orgId}
        usuarioAtualId={user.id}
        podeMudar={ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent || (user.is_platform_admin && !user.support)}
      />
    </div>
  );
}
