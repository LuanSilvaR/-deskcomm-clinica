/**
 * FORK clinic (prontuário F8) — o prontuário do paciente em uma página para
 * IMPRIMIR ou salvar em PDF (pelo navegador).
 *
 * Fora do layout do app de propósito: sem menu, sem barra, só o documento.
 * Exige `prontuario.exportar` (chave clínica, gerência); tem limite por pessoa
 * e cada exportação é auditada (só quantos atendimentos, nunca o conteúdo).
 */
import type { StatusDoDocumento } from "@/lib/clinic/documentos/tipos";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";

import { ProntuarioImpressao } from "@/components/clinic/prontuario/ProntuarioImpressao";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { audit } from "@/lib/audit";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { permissoesNaPagina } from "@/lib/clinic/acesso/pagina";
import { lerLinhaDoTempo } from "@/lib/clinic/prontuario/linha-do-tempo";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { traduzir } from "@/lib/i18n/dicionario";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prontuário", robots: { index: false, follow: false } };

export default async function ImprimirProntuarioPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const user = await requireAuth();
  const t = (s: string) => traduzir(s, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const permissoes = await permissoesNaPagina(user, activeOrg.orgId);
  if (!permissoes.has("prontuario.exportar")) redirect("/app");
  const { contactId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(contactId)) notFound();

  const limite = await checkRateLimit(`clinic-exportacao:${user.id}`, 10, 3600);
  if (!limite.allowed) {
    return (
      <p className="p-6 text-sm">{t("Muitas exportações seguidas. Tente de novo mais tarde.")}</p>
    );
  }

  const org = activeOrg.orgId;
  const supabase = await createClient();
  const [{ data: contato }, { data: empresa }] = await Promise.all([
    supabase
      .from("contacts")
      .select("name, display_name, phone_number, birthdate")
      .eq("organization_id", org)
      .eq("id", contactId)
      .maybeSingle(),
    supabase.from("organizations").select("display_name").eq("id", org).maybeSingle(),
  ]);
  if (!contato) notFound();
  const linha = await lerLinhaDoTempo(supabase, org, contactId, { limite: 500 });
  const documentos = permissoes.has("documentos.ver")
    ? ((
        await supabase
          .from("clinic_documentos_emitidos")
          .select("titulo, status, sha256, created_at")
          .eq("organization_id", org)
          .eq("contact_id", contactId)
          .order("created_at", { ascending: true })
      ).data ?? [])
    : [];

  void audit({
    action: "clinic.prontuario_exportado",
    actorUserId: user.id,
    organizationId: org,
    resourceType: "contact",
    resourceId: contactId,
    requestId: randomUUID(),
    metadata: { atendimentos: linha.atendimentos.length, documentos: documentos.length },
  });

  return (
    <IdiomaProvider locale={user.idioma}>
      <ProntuarioImpressao
        clinica={(empresa?.display_name as string | null) ?? null}
        paciente={nomeDoContato(
          contato as {
            name: string | null;
            display_name: string | null;
            phone_number: string | null;
          },
        )}
        nascimento={(contato as { birthdate?: string | null }).birthdate ?? null}
        atendimentos={linha.atendimentos}
        documentos={
          documentos as Array<{
            titulo: string;
            status: StatusDoDocumento;
            sha256: string;
            created_at: string;
          }>
        }
        geradoPor={user.email ?? null}
      />
    </IdiomaProvider>
  );
}
