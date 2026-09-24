/**
 * Agenda do dia (fork clinic) — cada profissional com a ocupação, os horários
 * livres e o status de cada paciente, com filtros na URL. Nasce desligada
 * (`clinic.agenda_do_dia`, migration 9014): liga em Configurações ›
 * Profissionais. Porta: lib/navigation/catalogo.ts.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { exigePermissaoNaPagina } from "@/lib/clinic/acesso/pagina";
import { agendaDoDiaLigada } from "@/lib/clinic/flags";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

import { AgendaDoDia } from "./_client";

export const dynamic = "force-dynamic";

export default async function AgendaDoDiaPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const negado = await exigePermissaoNaPagina("agenda.ver");
  if (negado) return negado;

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("settings").eq("id", activeOrg.orgId).maybeSingle();
  const ligada = agendaDoDiaLigada((org as { settings?: unknown } | null)?.settings);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Agenda do dia")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Cada profissional com a ocupação, os horários livres e o status de cada paciente. Atualiza sozinha.")}
        </p>
      </header>
      {ligada ? (
        <Suspense fallback={<p className="text-sm text-text-muted">{t("Carregando…")}</p>}>
          <AgendaDoDia orgId={activeOrg.orgId} />
        </Suspense>
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-sm" data-testid="agenda-do-dia-desligada">
          <p>{t("A Agenda do dia está desligada nesta empresa.")}</p>
          <Link href="/app/settings/tenant/profissionais" className="mt-1 inline-block underline">
            {t("Ligar em Configurações › Profissionais")}
          </Link>
        </div>
      )}
    </div>
  );
}
