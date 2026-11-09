/**
 * GET /api/v1/clinic/orcamentos/[id]/contrato — FORK clinic (orçamento O3):
 * o contrato do orçamento em PDF (texto congelado, sha256 e o aceite).
 *
 * `orcamentos.ver`: o orçamento é lido com a sessão (RLS decide). O documento
 * ligado a ele é lido pelo service role, filtrado pela organização da SESSÃO e
 * pelo `documento_id` gravado no orçamento — a recepção vê o contrato do
 * orçamento sem ganhar acesso aos demais documentos do paciente (9044). O
 * contrato não é conteúdo clínico. Download auditado, sem cache.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { orcamentoNoEscopo } from "@/lib/clinic/orcamentos/escopo";
import { gerarPdfDoDocumentoEmitido } from "@/lib/clinic/documentos/pdf-servidor";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("orcamentos.ver", { requestId, resource: "clinic_orcamentos" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("not_found", t("Orçamento não encontrado."), 404, { requestId });
  const org = authz.org.orgId;

  const supabase = await createClient();
  // FORK clinic (O5, revisão security-lgpd): só pacientes do escopo de quem pede.
  if (!(await orcamentoNoEscopo(supabase, org, authz.user.id, id))) {
    return fail("not_found", t("Orçamento não encontrado."), 404, { requestId });
  }
  const { data: orc } = await supabase
    .from("clinic_orcamentos")
    .select("id, documento_id, numero, versao")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  const documentoId = (orc as { documento_id: string | null } | null)?.documento_id;
  if (!documentoId) return fail("not_found", t("Este orçamento ainda não tem contrato."), 404, { requestId });

  // Papel timbrado único (D3): o mesmo PDF dos demais documentos emitidos, com
  // o número do orçamento no eyebrow e a marca do snapshot do contrato.
  const numero = (orc as { numero?: number | null; versao?: number | null } | null)?.numero ?? null;
  const versao = (orc as { versao?: number | null } | null)?.versao ?? 1;
  const r = await gerarPdfDoDocumentoEmitido({
    sessao: supabase,
    admin: createAdminClient(),
    orgId: org,
    documentoId,
    orcamentoId: id,
    numero: numero ? `${String(numero).padStart(3, "0")}${versao > 1 ? ` v${versao}` : ""}` : null,
  });
  if (!r) return fail("not_found", t("Este orçamento ainda não tem contrato."), 404, { requestId });
  const pdf = r.pdf;
  const d = { status: r.status };

  void audit({
    action: "clinic.orcamento_contrato_baixado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_orcamento",
    resourceId: id,
    requestId,
    metadata: { documento_id: documentoId, status: d.status },
  });
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contrato-orcamento-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
