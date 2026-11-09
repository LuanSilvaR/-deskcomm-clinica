/**
 * /imprimir/prontuario/:contactId — FORK clinic (prontuário F9 → papel timbrado D4).
 *
 * A impressão do prontuário era uma página HTML própria (Tailwind), com estilo
 * paralelo ao PDF. Com o papel timbrado único (docs/padrao-documentos.md), há
 * UM renderizador: esta página só confere a permissão e manda para o PDF, que
 * já faz o escopo de paciente, o limite de exportações e a auditoria. O
 * endereço continua valendo para os links que apontam para cá.
 */
import { notFound, redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { permissoesNaPagina } from "@/lib/clinic/acesso/pagina";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prontuário", robots: { index: false, follow: false } };

export default async function ImprimirProntuarioPage({ params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const permissoes = await permissoesNaPagina(user, activeOrg.orgId);
  if (!permissoes.has("prontuario.exportar")) redirect("/app");
  const { contactId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(contactId)) notFound();
  redirect(`/api/v1/clinic/pacientes/${contactId}/prontuario/pdf`);
}
