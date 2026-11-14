/**
 * Procedimento (fork clinic, 9015) — `/app/procedimentos/novo` cadastra;
 * `/app/procedimentos/:id` mostra e edita.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { exigePermissaoNaPagina } from "@/lib/clinic/acesso/pagina";

import { ModuloDesligado, moduloLigado } from "../_desligado";
import { DetalheDoProcedimento } from "./_client";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProcedimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const negado = await exigePermissaoNaPagina(id === "novo" ? "procedimentos.gerenciar" : "procedimentos.ver");
  if (negado) return negado;
  if (id !== "novo" && !UUID.test(id)) redirect("/app/procedimentos");

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {(await moduloLigado(activeOrg.orgId)) ? <DetalheDoProcedimento id={id === "novo" ? null : id} /> : <ModuloDesligado idioma={user.idioma} />}
    </div>
  );
}
