/**
 * GET /api/v1/clinic/pacientes/:contactId/prontuario/pdf — o prontuário em PDF
 * (FORK clinic, prontuário F9). `prontuario.exportar`, limite por pessoa,
 * auditado (só contagens). Resposta sem cache.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/api/wrappers";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { lerLinhaDoTempo } from "@/lib/clinic/prontuario/linha-do-tempo";
import { gerarPdfDoProntuario } from "@/lib/clinic/prontuario/pdf";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ contactId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("prontuario.exportar", {
    requestId,
    resource: "clinic_atendimentos",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success)
    return fail("validation_failed", t("id inválido"), 422, { requestId });
  const limite = await checkRateLimit(`clinic-exportacao:${authz.user.id}`, 10, 3600);
  if (!limite.allowed)
    return fail("rate_limited", t("Muitas exportações seguidas. Tente de novo mais tarde."), 429, {
      requestId,
    });
  const org = authz.org.orgId;

  const supabase = await createClient();
  const [{ data: contato }, { data: empresa }, { data: cab }] = await Promise.all([
    supabase
      .from("contacts")
      .select("name, display_name, phone_number, birthdate")
      .eq("organization_id", org)
      .eq("id", contactId)
      .maybeSingle(),
    supabase.from("organizations").select("display_name, timezone").eq("id", org).maybeSingle(),
    supabase
      .from("clinic_prontuarios")
      .select("alergias, alertas")
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .maybeSingle(),
  ]);
  if (!contato) return fail("not_found", t("Paciente não encontrado."), 404, { requestId });
  const linha = await lerLinhaDoTempo(supabase, org, contactId, { limite: 500 });
  const documentos = authz.permissoes.has("documentos.ver")
    ? ((
        await supabase
          .from("clinic_documentos_emitidos")
          .select("titulo, status, sha256, created_at")
          .eq("organization_id", org)
          .eq("contact_id", contactId)
          .order("created_at", { ascending: true })
      ).data ?? [])
    : [];
  const tag = authz.user.idioma === "es" ? "es" : "pt-BR";
  // Horários no fuso da CLÍNICA (o servidor roda em UTC).
  const fuso = ((empresa as { timezone?: string | null } | null)?.timezone ||
    "America/Sao_Paulo") as string;
  const pdf = await gerarPdfDoProntuario({
    clinica: (empresa?.display_name as string | null) ?? null,
    paciente: nomeDoContato(
      contato as { name: string | null; display_name: string | null; phone_number: string | null },
    ),
    nascimento: (contato as { birthdate?: string | null }).birthdate ?? null,
    alergias: (cab?.alergias as string | null) ?? null,
    alertas: (cab?.alertas as string | null) ?? null,
    emitidoEm: new Date().toISOString(),
    geradoPor: authz.user.email ?? null,
    atendimentos: linha.atendimentos,
    documentos: documentos as Array<{
      titulo: string;
      status: string;
      sha256: string;
      created_at: string;
    }>,
    t,
    data: (iso) =>
      new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short", timeZone: fuso }),
  });

  void audit({
    action: "clinic.prontuario_exportado",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "contact",
    resourceId: contactId,
    requestId,
    metadata: {
      atendimentos: linha.atendimentos.length,
      documentos: documentos.length,
      area: "pdf",
    },
  });
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="prontuario-${contactId.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
