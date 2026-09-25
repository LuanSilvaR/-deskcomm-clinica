/**
 * FORK clinic (prontuário F7) — um anexo.
 *
 * GET   — abre o arquivo (ou `?miniatura=1`): a linha é lida com a SESSÃO (a RLS
 *         decide se a pessoa pode ver aquele tipo); só então o service role
 *         assina uma URL de 60 s e responde 307. Abrir o arquivo inteiro é
 *         auditado; há limite por pessoa.
 * PATCH — `anular` (motivo) ou marcar/desmarcar `divulgacao` (só na finalidade
 *         que o paciente autorizou no termo de uso de imagem).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/clinic/acesso/require-permission";
import { armazenamentoClinico } from "@/lib/clinic/anexos/armazenamento";
import { erroDoBanco } from "@/lib/clinic/atendimento/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const corpo = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("anular"), motivo: z.string().trim().min(3).max(300) }).strict(),
  z
    .object({
      acao: z.literal("divulgacao"),
      opcao: z.enum(["ensino_sem_identificacao", "divulgacao_sem_rosto", "divulgacao_com_identificacao"]).nullable(),
    })
    .strict(),
]);

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requirePermission("prontuario.ver", { requestId, resource: "clinic_anexos" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const limite = await checkRateLimit(`clinic-anexo:${authz.user.id}`, 600, 600);
  if (!limite.allowed) return fail("rate_limited", traduzir("Muitas aberturas seguidas. Aguarde alguns minutos.", authz.user.idioma), 429, { requestId });
  const miniatura = new URL(req.url).searchParams.get("miniatura") === "1";
  const org = authz.org.orgId;

  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_anexos")
    .select("storage_key, miniatura_key, contact_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  const linha = data as { storage_key: string; miniatura_key: string | null; contact_id: string } | null;
  const caminho = miniatura ? (linha?.miniatura_key ?? linha?.storage_key) : linha?.storage_key;
  if (!linha || !caminho) return new Response(null, { status: 404 });

  const url = await armazenamentoClinico().urlTemporaria(caminho);
  if (!url) return new Response(null, { status: 404 });
  if (!miniatura) {
    void audit({
      action: "clinic.anexo_visto",
      actorUserId: authz.user.id,
      organizationId: org,
      resourceType: "clinic_anexo",
      resourceId: id,
      requestId,
      metadata: { contact_id: linha.contact_id },
    });
  }
  return new Response(null, { status: 307, headers: { Location: url, "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requirePermission("prontuario.ver", { requestId, resource: "clinic_anexos" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", t("id inválido"), 422, { requestId });
  const lido = corpo.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const org = authz.org.orgId;
  const d = lido.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_clinic_anexo_mudar", {
    p_org: org,
    p_anexo: id,
    p_acao: d.acao,
    p_valor: d.acao === "anular" ? d.motivo : d.opcao,
  });
  if (error) {
    const e = erroDoBanco(error, requestId);
    return fail(e.code, t(e.message), e.status, { requestId });
  }
  void audit({
    action: d.acao === "anular" ? "clinic.anexo_anulado" : "clinic.foto_divulgacao",
    actorUserId: authz.user.id,
    organizationId: org,
    resourceType: "clinic_anexo",
    resourceId: id,
    requestId,
    metadata: d.acao === "divulgacao" ? { opcao: d.opcao } : {},
  });
  return ok({ id }, { requestId });
}
