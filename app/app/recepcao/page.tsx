/**
 * Painel da recepção (fork clinic, migration 9003) — o dia da clínica por
 * status da visita, em tempo real. Porta: lib/navigation/catalogo.ts.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { permissoesNaPagina } from "@/lib/clinic/acesso/pagina";
import { traduzir } from "@/lib/i18n/dicionario";

import { PainelDaRecepcao } from "./_client";

export const dynamic = "force-dynamic";

export default async function RecepcaoPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia } = await searchParams;
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const permissoes = await permissoesNaPagina(user, activeOrg.orgId);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Recepção")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Os pacientes agendados hoje, do momento em que chegam até o fim do atendimento. Atualiza sozinho.")}{" "}
          <Link href="/app/agenda/faltas" className="underline" data-testid="recepcao-abrir-faltas">
            {t("Ver pacientes que faltam")}
          </Link>
        </p>
      </header>
      <PainelDaRecepcao
        orgId={activeOrg.orgId}
        dia={dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null}
        usuarioAtualId={user.id}
        podeMudar={permissoes.has("recepcao.mudar_status_visita")}
      />
    </div>
  );
}
