/**
 * GET /api/v1/clinic/documentos/:id/pdf — o documento emitido (termo,
 * consentimento, autorização, uso de imagem, contrato) no papel timbrado
 * (FORK clinic, docs/padrao-documentos.md, fase D3).
 *
 * `documentos.ver` + escopo de paciente (o mesmo da lista de documentos). A
 * organização vem da sessão. O texto é o congelado na emissão; a marca é a do
 * snapshot do documento (migration 8014). Auditado sem o conteúdo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { gerarPdfDoDocumentoEmitido } from "@/lib/clinic/documentos/pdf-servidor";
import { pacienteNoEscopo } from "@/lib/clinic/pacientes/escopo-de-pacientes";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("documentos.ver", { requestId, resource: "clinic_documentos_emitidos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("not_found", t("Documento não encontrado."), 404, { requestId });
  const org = authz.org.orgId;

  const sessao = await createClient();
  // RLS + escopo: o documento tem de ser visível a esta pessoa, e o paciente estar no escopo dela.
  const { data: visivel } = await sessao
    .from("clinic_documentos_emitidos")
    .select("contact_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  const contato = (visivel as { contact_id: string } | null)?.contact_id;
  if (!contato || !(await pacienteNoEscopo(sessao, org, authz.user.id, contato))) {
    return fail("not_found", t("Documento não encontrado."), 404, { requestId });
  }

  const r = await gerarPdfDoDocumentoEmitido({ sessao, admin: createAdminClient(), orgId: org, documentoId: id });
  if (!r) return fail("not_found", t("Documento não encontrado."), 404, { requestId });

  void audit({
    action: "clinic.documento_pdf_baixado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_documento_emitido",
    resourceId: id,
    requestId,
    metadata: { status: r.status },
  });
  const nome = `${r.titulo}.pdf`.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
  return new Response(new Uint8Array(r.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}
