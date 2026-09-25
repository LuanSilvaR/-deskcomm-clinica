/**
 * FORK clinic (prontuário F6) — documentos do paciente.
 *
 * GET  — emitidos, com status e o histórico de aceite/revogação (`documentos.ver`).
 * POST — emite: o servidor troca os marcadores do modelo (nome do paciente, da
 *        clínica, do profissional, procedimento, data) e o banco congela o
 *        texto com sha256 (`documentos.emitir`).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { renderizarTermo } from "@/lib/clinic/documentos/render";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { leituraClinicaPermitida } from "@/lib/clinic/prontuario/limite";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contactId: string }> };

const corpo = z
  .object({
    modelo_versao_id: z.string().uuid(),
    procedimento: z.string().trim().max(200).nullish(),
    atendimento_id: z.string().uuid().nullish(),
    plano_id: z.string().uuid().nullish(),
    validade_ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  })
  .strict();

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("documentos.ver", { requestId, resource: "clinic_documentos_emitidos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  if (!(await leituraClinicaPermitida(authz.user.id, "documentos"))) {
    return fail("rate_limited", t("Muitas leituras seguidas. Aguarde alguns minutos."), 429, { requestId });
  }
  const org = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_documentos_emitidos")
    .select(
      "id, tipo, titulo, conteudo, opcoes, sha256, status, motivo, validade_ate, atendimento_id, created_at, " +
        "clinic_documento_aceites(id, tipo, canal, nome_digitado, opcoes_escolhidas, motivo, created_at)",
    )
    .eq("organization_id", org)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  void audit({
    action: "clinic.prontuario_visto",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "contact",
    resourceId: contactId,
    requestId,
    metadata: { area: "documentos" },
  });
  return ok(
    {
      documentos: data ?? [],
      pode_emitir: authz.permissoes.has("documentos.emitir"),
      pode_colher_aceite: authz.permissoes.has("documentos.colher_aceite"),
      pode_revogar: authz.permissoes.has("documentos.revogar"),
    },
    { requestId },
  );
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("documentos.emitir", { requestId, resource: "clinic_documentos_emitidos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { contactId } = await ctx.params;
  if (!z.string().uuid().safeParse(contactId).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const d = lido.data;

  const supabase = await createClient();
  const [versao, contato, empresa, prof] = await Promise.all([
    supabase
      .from("clinic_modelos_documento_versoes")
      .select("conteudo, clinic_modelos_documento(nome)")
      .eq("organization_id", org)
      .eq("id", d.modelo_versao_id)
      .maybeSingle(),
    supabase.from("contacts").select("name, display_name, phone_number").eq("organization_id", org).eq("id", contactId).maybeSingle(),
    supabase.from("organizations").select("display_name").eq("id", org).maybeSingle(),
    supabase.from("clinic_professionals").select("nome:display_name").eq("organization_id", org).eq("user_id", authz.user.id).maybeSingle(),
  ]);
  if (!versao.data || !contato.data) return fail("not_found", t("Modelo ou paciente não encontrado."), 404, { requestId });
  const modelo = versao.data.clinic_modelos_documento as { nome: string } | { nome: string }[] | null;
  const titulo = (Array.isArray(modelo) ? modelo[0]?.nome : modelo?.nome) ?? t("Documento");
  const conteudo = renderizarTermo(versao.data.conteudo as string, {
    "paciente.nome": nomeDoContato(contato.data as { name: string | null; display_name: string | null; phone_number: string | null }),
    "clinica.nome": (empresa.data?.display_name as string | null) ?? null,
    "profissional.nome": (prof.data as { nome?: string | null } | null)?.nome ?? null,
    procedimento: d.procedimento ?? null,
    data: new Date().toLocaleDateString(authz.user.idioma === "es" ? "es" : "pt-BR", { dateStyle: "long" }),
  });

  const { data, error } = await supabase.rpc("fn_clinic_documento_emitir", {
    p_org: org,
    p_contact: contactId,
    p_modelo_versao: d.modelo_versao_id,
    p_titulo: titulo,
    p_conteudo: conteudo,
    p_atendimento: d.atendimento_id ?? null,
    p_plano: d.plano_id ?? null,
    p_validade_ate: d.validade_ate ?? null,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  const r = data as { id: string; sha256: string };
  void audit({
    action: "clinic.documento_emitido",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_documento",
    resourceId: r.id,
    requestId,
    metadata: { contact_id: contactId, sha256: r.sha256 },
  });
  return ok(r, { requestId });
}
