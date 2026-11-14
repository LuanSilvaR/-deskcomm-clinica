/**
 * /app/meu-dia — FORK clinic (agenda S5): a tela inicial do PROFISSIONAL.
 *
 * O dia de hoje da própria agenda: contadores, o próximo paciente (com
 * "Iniciar atendimento" quando a recepção já liberou), o atendimento em
 * andamento e a lista do dia com o status de cada um. Quem chega aqui é quem
 * pode atender (`atendimento.iniciar`); a recepção tem o Início dela.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { exigePermissaoNaPagina } from "@/lib/clinic/acesso/pagina";

import { MeuDia } from "./_client";

export const dynamic = "force-dynamic";

export default async function MeuDiaPage() {
  const negado = await exigePermissaoNaPagina("atendimento.iniciar");
  if (negado) return negado;
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const nome = user.full_name;
  return <MeuDia orgId={activeOrg.orgId} usuarioId={user.id} nome={nome} />;
}
