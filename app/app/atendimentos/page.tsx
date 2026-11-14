/**
 * "Meus atendimentos" (fork clinic, prontuário F1) — a fila do profissional:
 * quem está aguardando, em atendimento, os próximos e os finalizados do dia.
 * Porta: lib/navigation/catalogo.ts. Dados: /api/v1/clinic/atendimentos/fila.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { exigePermissaoNaPagina } from "@/lib/clinic/acesso/pagina";
import { traduzir } from "@/lib/i18n/dicionario";

import { FilaDeAtendimentos } from "./_client";

export const dynamic = "force-dynamic";

export default async function AtendimentosPage({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const negado = await exigePermissaoNaPagina("atendimento.ver_fila");
  if (negado) return negado;
  const { todos } = await searchParams;
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Meus atendimentos")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Quem chegou aparece em Aguardando na hora. Atualiza sozinho.")}
        </p>
      </header>
      <FilaDeAtendimentos orgId={activeOrg.orgId} usuarioAtualId={user.id} todosInicial={todos === "1"} />
    </div>
  );
}
